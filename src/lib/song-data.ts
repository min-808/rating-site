import { unstable_cache } from 'next/cache';
import { connectMongo } from './connect-db';
import type { SongMetaDocument } from './leaderboard';

/**
 * The game's song data the profile and level summary pages read: the song list (songs),
 * each song's details and jacket (songmeta), and the chart lists per level (level_charts).
 * It only changes when rating-scraper imports songs, so it's cached on the server rather
 * than read from MongoDB on every page view, and each read asks for just the fields used.
 *
 * Kept for CACHE_SECONDS, and cleared every night by /api/update-leaderboard (the same cron
 * that refreshes the leaderboard), so a song import shows up by the next morning at the
 * latest. Server only.
 */

export const SONG_DATA_TAG = 'song-data';
const CACHE_SECONDS = 6 * 60 * 60;

async function db() {
  return (await connectMongo()).db('maimai');
}

// cached, and plain JSON (what the cache stores), so no ObjectIds or Dates come back
const cached = <T>(key: string, read: () => Promise<T>) =>
  unstable_cache(async () => JSON.parse(JSON.stringify(await read())) as T, [key], {
    revalidate: CACHE_SECONDS,
    tags: [SONG_DATA_TAG],
  });

const SUFFIXES = ['bas', 'adv', 'exp', 'mas', 'remas'];

/** Every song, with what the level summary needs: its charts' levels and constants, version, genre, NA availability. */
export type SongLevelsDoc = { title: string; version?: string; intl?: string; na?: string | number; catcode?: string; [field: string]: unknown };
export const getSongLevels = cached<SongLevelsDoc[]>('song-levels-v2', async () => {
  const projection: Record<string, 0 | 1> = { _id: 0, title: 1, version: 1, intl: 1, na: 1, catcode: 1 };
  for (const s of SUFFIXES) {
    for (const prefix of ['', 'dx_']) {
      projection[`${prefix}lev_${s}`] = 1;
      projection[`${prefix}lev_${s}_i`] = 1;
    }
  }
  return (await db()).collection<SongLevelsDoc>('songs').find({}, { projection }).toArray();
});

/** Every song's NA availability and romanized title (for the favorites search). */
export type SongFlags = { title: string; na?: string | number; title_romaji?: string | null };
export const getSongFlags = cached<SongFlags[]>('song-flags-v1', async () =>
  (await db()).collection<SongFlags>('songs').find({}, { projection: { _id: 0, title: 1, na: 1, title_romaji: 1 } }).toArray());

/** Every song's details and jacket, keyed by title as players' scores spell it. */
export const getSongMeta = cached<SongMetaDocument[]>('song-meta-v1', async () =>
  (await db()).collection<SongMetaDocument>('songmeta')
    .find({}, { projection: { blob: 1, artist: 1, bpm: 1, version_code: 1, by_genre: 1, genre: 1 } })
    .toArray());

/** Each level's chart list (title and difficulty), from maimai NET's own level pages. */
export type LevelChartsDoc = { _id: string; charts?: { title: string; difficulty?: string | null }[] };
export const getLevelCharts = cached<LevelChartsDoc[]>('level-charts-v1', async () =>
  (await db()).collection<LevelChartsDoc>('level_charts')
    .find({}, { projection: { 'charts.title': 1, 'charts.difficulty': 1 } })
    .toArray());
