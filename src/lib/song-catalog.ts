import { unstable_cache } from 'next/cache';
import { connectMongo } from './connect-db';
import { getSongLevels, getSongMeta, getSongFlags, SONG_DATA_TAG } from './song-data';
import { CHART_DIFFICULTIES } from './difficulties';
import { artistSlug, songKey, songKeyFromLegacyId, titleSlug } from './song-id';
import { versionName } from './versions';
import type { BrowserSong, BrowserChart } from './song-browse';

/**
 * Every song in the game, for the song pages (/charts): the songs collection's charts and
 * versions, songmeta's jacket / artist / BPM, and the romanized titles for searching. All
 * three are already cached on the server (lib/song-data.ts); this joins them once and keeps
 * the result as long as they are kept, cleared by the same nightly job. Server only.
 *
 * One entry per song. A song stored twice (once as japan added it, once as international
 * did: same title and artist) is one entry. Two different songs sharing a title (the two
 * "Link"s, told apart by artist) are two, each matched to its players' scores by the genre
 * the scores list it under (scoreGenre). Songs that are japan only (intl "0") aren't listed,
 * like the level summary. Addresses: lib/song-id.ts.
 *
 * plays (how many players have a score on the song, for "sort: popularity") is the one part
 * read from the players: one small count per title, done by the database.
 */

export type CatalogChart = {
  kind: 'standard' | 'dx';
  difficulty: (typeof CHART_DIFFICULTIES)[number];
  level: string | null; // as the game shows it, "13+"
  internal: number; // the constant, 13.7
};

export type CatalogSong = {
  id: string; // the address: /charts/<id> (lib/song-id.ts)
  key: string; // what's saved for it (hearts): the folded title, plus "|<artist>" for the newer of two songs sharing a title
  title: string;
  romaji: string | null;
  artist: string | null;
  bpm: number | null;
  genre: string | null;
  version: string | null;
  versionCode: number | null;
  jacket: string | null;
  na: boolean;
  plays: number; // players with a score on it, not counting those who hide their scores
  titles: string[]; // every way players' scores spell the title, for finding their scores
  scoreGenre: string | null; // when another song shares the title: the genre its scores are listed under
  docArtist: string | null; // the artist as the songs collection has it (finds its record when the title is shared)
  charts: CatalogChart[]; // standard before DX, easiest first
};

const SUFFIX: Record<string, string> = { basic: 'bas', advanced: 'adv', expert: 'exp', master: 'mas', remaster: 'remas' };

// how many players have a score on each title, keyed by the folded title (lib/song-id.ts)
async function playCounts(): Promise<Map<string, number>> {
  const rows = await (await connectMongo()).db('maimai').collection('players').aggregate<{ _id: string; n: number }>([
    { $match: { scores_opt_out: { $ne: true } } },
    { $project: { _id: 0, titles: { $setUnion: [{ $ifNull: ['$songs.title', []] }, []] } } }, // each title once per player
    { $unwind: '$titles' },
    { $group: { _id: '$titles', n: { $sum: 1 } } },
  ]).toArray();
  const counts = new Map<string, number>();
  for (const r of rows) if (typeof r._id === 'string') counts.set(songKey(r._id), (counts.get(songKey(r._id)) ?? 0) + r.n);
  return counts;
}

async function build(): Promise<CatalogSong[]> {
  const [levels, flags, metas, plays] = await Promise.all([getSongLevels(), getSongFlags(), getSongMeta(), playCounts()]);
  const metaByKey = new Map(metas.map((m) => [songKey(m._id), m]));
  const romajiByKey = new Map<string, string>();
  for (const f of flags) if (f.title_romaji) romajiByKey.set(songKey(f.title), f.title_romaji);

  // the song documents by title, then by artist: one artist is one song (stored once or twice)
  const byTitle = new Map<string, Map<string, typeof levels>>();
  for (const doc of levels) {
    if (String(doc.intl ?? '1') === '0') continue; // japan only: not playable here
    const titleKey = songKey(doc.title);
    const artists = byTitle.get(titleKey) ?? new Map();
    const artistKey = songKey(doc.artist ?? '');
    artists.set(artistKey, [...(artists.get(artistKey) ?? []), doc]);
    byTitle.set(titleKey, artists);
  }

  const songs: (CatalogSong & { base: string })[] = [];
  for (const [titleKey, artists] of byTitle) {
    const meta = metaByKey.get(titleKey);
    const versionOf = (docs: typeof levels) => Math.min(...docs.map((d) => Number(d.version)).filter(Number.isFinite));
    // oldest first: the oldest of two songs sharing a title keeps the plain key (and so any hearts on it)
    const groups = [...artists.values()].sort((a, b) => versionOf(a) - versionOf(b));
    const shared = groups.length > 1;

    groups.forEach((docs, index) => {
      const first = docs.find((d) => Number(d.version) === versionOf(docs)) ?? docs[0];
      // a shared title keeps each song's details in songmeta's by_genre, under the genre its scores use
      const genreEntry = shared
        ? Object.entries(meta?.by_genre ?? {}).find(([, m]) => songKey(m.artist ?? '') === songKey(first.artist ?? ''))
        : undefined;
      const details = genreEntry?.[1] ?? (shared ? undefined : meta);
      const code = versionOf(docs);
      const chartMap = new Map<string, CatalogChart>();
      let na = false;
      for (const doc of docs) {
        na = na || String(doc.na) !== '0';
        for (const kind of ['standard', 'dx'] as const) {
          for (const difficulty of CHART_DIFFICULTIES) {
            const field = `${kind === 'dx' ? 'dx_' : ''}lev_${SUFFIX[difficulty]}`;
            const internal = parseFloat(String(doc[`${field}_i`] ?? ''));
            if (!Number.isFinite(internal)) continue;
            chartMap.set(`${kind}-${difficulty}`, { kind, difficulty, internal, level: doc[field] != null ? String(doc[field]) : null });
          }
        }
      }
      songs.push({
        id: '', // below, once every song is known
        base: titleSlug(first.title),
        key: index === 0 ? titleKey : `${titleKey}|${songKey(first.artist ?? '')}`,
        title: first.title,
        romaji: romajiByKey.get(titleKey) ?? null,
        artist: details?.artist ?? first.artist ?? null,
        bpm: details?.bpm ?? null,
        // a shared title shows its song's own genre, as the song list's genre filter spells it
        genre: (shared ? null : meta?.genre) ?? (first.catcode != null ? String(first.catcode) : null),
        version: Number.isFinite(code) ? versionName(code) ?? null : null,
        versionCode: Number.isFinite(code) ? code : null,
        jacket: details?.blob ?? null,
        na,
        // a shared title's count is for the title: scores are counted by title (playCounts)
        plays: plays.get(titleKey) ?? 0,
        // typeof, not Boolean: a blank title ("") is still a title players' scores can have
        titles: [...new Set([first.title, meta?._id].filter((t): t is string => typeof t === 'string'))],
        scoreGenre: shared ? genreEntry?.[0] ?? null : null,
        docArtist: shared ? first.artist ?? null : null,
        charts: [...chartMap.values()].sort(
          (a, b) => Number(a.kind === 'dx') - Number(b.kind === 'dx')
            || CHART_DIFFICULTIES.indexOf(a.difficulty) - CHART_DIFFICULTIES.indexOf(b.difficulty)),
      });
    });
  }

  // addresses: the title, or title + artist for songs whose plain address would be shared
  // (a shared title, or two titles that come out the same). still the same: + the version
  const listed = songs.filter((s) => s.charts.length > 0); // utage and the like have no constants
  const byBase = new Map<string, typeof listed>();
  for (const s of listed) byBase.set(s.base, [...(byBase.get(s.base) ?? []), s]);
  for (const group of byBase.values()) {
    for (const s of group) s.id = group.length > 1 ? `${s.base}-${artistSlug(s.artist)}` : s.base;
  }
  const byId = new Map<string, typeof listed>();
  for (const s of listed) byId.set(s.id, [...(byId.get(s.id) ?? []), s]);
  for (const group of byId.values()) if (group.length > 1) for (const s of group) s.id = `${s.id}-${s.versionCode ?? 0}`;

  return listed.map(({ base, ...song }) => song);
}

export const getCatalog = unstable_cache(build, ['song-catalog-v4'] /* v2: the blank-titled song got an address (lib/song-id.ts). v3: plays. v4: readable addresses, the "Link"s apart */, {
  revalidate: 6 * 60 * 60,
  tags: [SONG_DATA_TAG],
});

// an address as it comes in: maybe still percent-encoded (/charts/%E3%82%AC…)
const decoded = (id: string) => {
  try { return decodeURIComponent(id); } catch { return id; }
};

/** The song at an address, or null. Only its current address: see songAddressRedirect for the others. */
export async function getCatalogSong(id: string): Promise<CatalogSong | null> {
  const wanted = decoded(id);
  return (await getCatalog()).find((s) => s.id === wanted) ?? null;
}

/**
 * Where an address that isn't a song's own now goes, or null: the plain address of songs
 * that got the artist added (/charts/link: the oldest of them), and old base64 addresses.
 */
export async function songAddressRedirect(id: string): Promise<string | null> {
  const wanted = decoded(id);
  const catalog = await getCatalog();
  const oldest = (songs: CatalogSong[]) => [...songs].sort((a, b) => (a.versionCode ?? 0) - (b.versionCode ?? 0))[0]?.id ?? null;
  const sameTitle = catalog.filter((s) => titleSlug(s.title) === wanted);
  if (sameTitle.length > 0) return oldest(sameTitle);
  const key = songKeyFromLegacyId(wanted);
  if (key === null) return null;
  return catalog.find((s) => s.key === key)?.id ?? oldest(catalog.filter((s) => songKey(s.title) === key));
}

/**
 * Which song a player's score is for: by its title, and by its genre when two songs share
 * the title. index: catalogByTitle(catalog), built once per page.
 */
export function catalogByTitle(catalog: CatalogSong[]): Map<string, CatalogSong[]> {
  const index = new Map<string, CatalogSong[]>();
  for (const s of catalog) {
    for (const title of s.titles) {
      const key = songKey(title);
      const list = index.get(key) ?? [];
      if (!list.includes(s)) list.push(s);
      index.set(key, list);
    }
  }
  return index;
}
export function songForScore(index: Map<string, CatalogSong[]>, score: { title: string; genre?: string | null }): CatalogSong | null {
  const list = index.get(songKey(score.title)) ?? [];
  if (list.length <= 1) return list[0] ?? null;
  // scores spell genres the international way ("niconico＆VOCALOID™"), the song list the japanese way
  return list.find((s) => s.scoreGenre === score.genre || s.genre === score.genre) ?? list[0];
}

/**
 * Each score's song page, on the scores whose page isn't simply their title's
 * (titleSlug): a shared title, a symbol-only title… The score dialogs link to
 * song_page when it's there (components/BestFifty.tsx). Only those few carry it.
 */
export function withSongPages<T extends { title: string; genre?: string | null; song_page?: string }>(scores: T[], catalog: CatalogSong[]): T[] {
  const index = catalogByTitle(catalog);
  return scores.map((score) => {
    const song = songForScore(index, score);
    return song && song.id !== titleSlug(score.title) ? { ...score, song_page: song.id } : score;
  });
}

/** The slimmed-down song the list page sends to the browser. */
function toBrowserSong(s: CatalogSong): BrowserSong {
  const charts: BrowserChart[] = s.charts.map((c) => [c.kind === 'dx' ? 1 : 0, CHART_DIFFICULTIES.indexOf(c.difficulty), c.internal]);
  return {
    id: s.id, title: s.title, romaji: s.romaji, artist: s.artist, genre: s.genre, version: s.version,
    versionCode: s.versionCode, jacket: s.jacket, na: s.na, plays: s.plays, charts,
  };
}

/**
 * The whole list for the browser. Every jacket address starts the same way (the blob
 * store's address), and that part would otherwise be sent once per song, so it is sent once
 * as jacketBase and cut off each song's jacket; the browser puts it back (jacketBase + jacket).
 */
export function toBrowserList(catalog: CatalogSong[]): { songs: BrowserSong[]; jacketBase: string } {
  const songs = catalog.map(toBrowserSong);
  const jackets = songs.map((s) => s.jacket).filter((j): j is string => Boolean(j));
  let base = jackets[0] ?? '';
  for (const j of jackets) while (base && !j.startsWith(base)) base = base.slice(0, -1);
  base = base.slice(0, base.lastIndexOf('/') + 1); // only whole folders
  if (base.length < 12) return { songs, jacketBase: '' };
  return { songs: songs.map((s) => ({ ...s, jacket: s.jacket ? s.jacket.slice(base.length) : null })), jacketBase: base };
}
