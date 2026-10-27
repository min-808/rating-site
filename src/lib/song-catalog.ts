import { unstable_cache } from 'next/cache';
import { getSongLevels, getSongMeta, getSongFlags, SONG_DATA_TAG } from './song-data';
import { CHART_DIFFICULTIES } from './difficulties';
import { songId, songKey, songKeyFromId } from './song-id';
import { versionName } from './versions';
import type { BrowserSong, BrowserChart } from './song-browse';

/**
 * Every song in the game, for the song pages (/songs): the songs collection's charts and
 * versions, songmeta's jacket / artist / BPM, and the romanized titles for searching. All
 * three are already cached on the server (lib/song-data.ts); this joins them once and keeps
 * the result as long as they are kept, cleared by the same nightly job. Server only.
 *
 * One entry per title. Songs that are japan only (intl "0") aren't listed, like the level
 * summary. The two "Link" songs that share a title share an entry too, as they already do
 * in the level summary.
 */

export type CatalogChart = {
  kind: 'standard' | 'dx';
  difficulty: (typeof CHART_DIFFICULTIES)[number];
  level: string | null; // as the game shows it, "13+"
  internal: number; // the constant, 13.7
};

export type CatalogSong = {
  id: string; // the address: /songs/<id>
  key: string; // the title, folded (lib/song-id.ts)
  title: string;
  romaji: string | null;
  artist: string | null;
  bpm: number | null;
  genre: string | null;
  version: string | null;
  versionCode: number | null;
  jacket: string | null;
  na: boolean;
  titles: string[]; // every way players' scores spell the title, for finding their scores
  charts: CatalogChart[]; // standard before DX, easiest first
};

const SUFFIX: Record<string, string> = { basic: 'bas', advanced: 'adv', expert: 'exp', master: 'mas', remaster: 'remas' };

async function build(): Promise<CatalogSong[]> {
  const [levels, flags, metas] = await Promise.all([getSongLevels(), getSongFlags(), getSongMeta()]);
  const metaByKey = new Map(metas.map((m) => [songKey(m._id), m]));
  const romajiByKey = new Map<string, string>();
  for (const f of flags) if (f.title_romaji) romajiByKey.set(songKey(f.title), f.title_romaji);

  const songs = new Map<string, CatalogSong & { chartMap: Map<string, CatalogChart> }>();

  for (const doc of levels) {
    if (String(doc.intl ?? '1') === '0') continue; // japan only: not playable here
    const key = songKey(doc.title);
    let entry = songs.get(key);
    if (!entry) {
      const meta = metaByKey.get(key);
      const code = Number(doc.version);
      entry = {
        id: songId(doc.title),
        key,
        title: doc.title,
        romaji: romajiByKey.get(key) ?? null,
        artist: meta?.artist ?? null,
        bpm: meta?.bpm ?? null,
        genre: meta?.genre ?? (doc.catcode != null ? String(doc.catcode) : null),
        version: Number.isFinite(code) ? versionName(code) ?? null : null,
        versionCode: Number.isFinite(code) ? code : null,
        jacket: meta?.blob ?? null,
        na: false,
        titles: [...new Set([doc.title, meta?._id].filter((t): t is string => Boolean(t)))],
        charts: [],
        chartMap: new Map(),
      };
      songs.set(key, entry);
    }
    entry.na = entry.na || String(doc.na) !== '0';

    for (const kind of ['standard', 'dx'] as const) {
      for (const difficulty of CHART_DIFFICULTIES) {
        const field = `${kind === 'dx' ? 'dx_' : ''}lev_${SUFFIX[difficulty]}`;
        const internal = parseFloat(String(doc[`${field}_i`] ?? ''));
        if (!Number.isFinite(internal)) continue;
        entry.chartMap.set(`${kind}-${difficulty}`, {
          kind, difficulty, internal, level: doc[field] != null ? String(doc[field]) : null,
        });
      }
    }
  }

  return [...songs.values()]
    .map(({ chartMap, ...song }) => ({
      ...song,
      charts: [...chartMap.values()].sort(
        (a, b) => Number(a.kind === 'dx') - Number(b.kind === 'dx')
          || CHART_DIFFICULTIES.indexOf(a.difficulty) - CHART_DIFFICULTIES.indexOf(b.difficulty)),
    }))
    .filter((s) => s.charts.length > 0); // utage and the like have no constants
}

export const getCatalog = unstable_cache(build, ['song-catalog-v1'], {
  revalidate: 6 * 60 * 60,
  tags: [SONG_DATA_TAG],
});

export async function getCatalogSong(id: string): Promise<CatalogSong | null> {
  const key = songKeyFromId(id);
  if (!key) return null;
  return (await getCatalog()).find((s) => s.key === key) ?? null;
}

/** The slimmed-down song the list page sends to the browser. */
export function toBrowserSong(s: CatalogSong): BrowserSong {
  const charts: BrowserChart[] = s.charts.map((c) => [c.kind === 'dx' ? 1 : 0, CHART_DIFFICULTIES.indexOf(c.difficulty), c.internal]);
  return {
    id: s.id, title: s.title, romaji: s.romaji, artist: s.artist, genre: s.genre, version: s.version,
    versionCode: s.versionCode, jacket: s.jacket, na: s.na, bpm: s.bpm, charts,
  };
}
