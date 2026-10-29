import { chartBit, DIFFICULTY_ORDER, type MyCharts } from './song-browse';
import { new15, old35, rateSong, RATING_CAP } from './song-calc';
import { NEW_POOL_VERSIONS } from './versions';
import type { Song } from './leaderboard';
import { catalogByTitle, songForScore, type CatalogSong } from './song-catalog';

/**
 * A player's charts for the song list's own filters (/api/profile/my-charts): which charts
 * they've played, and which would raise their rating. Per song id, a bit per chart
 * (lib/song-browse.ts, chartBit).
 *
 * "Would raise their rating": not in their best 50, and an SSS+ (100.5%, no AP) on it would
 * rate above the floor of the half it counts toward (B15 for the new versions, B35 for the
 * rest). With fewer than 15 / 35 charts in a half, its floor is 0, so any chart counts.
 * Plain module (no database), so it can be tested on its own.
 */

const difficultyIndex = (d: string) =>
  DIFFICULTY_ORDER.indexOf(String(d ?? '').toLowerCase().replace(/[^a-z]/g, '') as (typeof DIFFICULTY_ORDER)[number]);
const kindOf = (kind: string) => (/dx/i.test(kind ?? '') ? 1 : 0);

export function buildMyCharts(
  scores: Song[],
  catalog: CatalogSong[],
): MyCharts & { floors: { new: number; old: number } } {
  // which song each score is for: by title, and by genre for a title two songs share
  const songsByTitle = catalogByTitle(catalog);

  const played: Record<string, number> = {};
  for (const s of scores) {
    const song = songForScore(songsByTitle, s);
    const index = difficultyIndex(s.difficulty);
    if (!song || index < 0) continue;
    played[song.id] = (played[song.id] ?? 0) | chartBit(kindOf(s.kind), index);
  }

  // the floors: the lowest rating that still counts in each half, 0 while a half isn't full
  const b15 = new15(scores);
  const b35 = old35(scores);
  const floorOf = (best: Song[], size: number) => (best.length < size ? 0 : Math.min(...best.map(rateSong)));
  const floors = { new: floorOf(b15, 15), old: floorOf(b35, 35) };
  const inBest50 = new Set([...b15, ...b35].map((s) => `${songForScore(songsByTitle, s)?.id}|${kindOf(s.kind)}|${difficultyIndex(s.difficulty)}`));

  const raise: Record<string, number> = {};
  for (const song of catalog) {
    const floor = song.version !== null && NEW_POOL_VERSIONS.includes(song.version) ? floors.new : floors.old;
    for (const chart of song.charts) {
      const kind = chart.kind === 'dx' ? 1 : 0;
      const index = DIFFICULTY_ORDER.indexOf(chart.difficulty);
      if (inBest50.has(`${song.id}|${kind}|${index}`)) continue;
      const best = rateSong({ achievement: RATING_CAP, internal_difficulty: chart.internal, ap: false } as Song);
      if (best > floor) raise[song.id] = (raise[song.id] ?? 0) | chartBit(kind, index);
    }
  }
  return { played, raise, floors };
}
