import { chartBit, DIFFICULTY_ORDER, type MyCharts } from './song-browse';
import { new15, old35, rateSong, RATING_CAP } from './song-calc';
import { NEW_POOL_VERSIONS } from './versions';
import type { Song } from './leaderboard';
import { catalogByTitle, songForScore, type CatalogSong } from './song-catalog';
import { chartKey, chartKeyNoArtist, type BandStats } from './recommend';

/**
 * A player's charts for the charts page's own filters (/api/profile/my-charts): which charts
 * they've played, and which are recommended. Per song id, a bit per chart
 * (lib/song-browse.ts, chartBit).
 *
 * Recommended charts would raise their rating: not in their best 50, and an SSS+ (100.5%,
 * no AP) on it would rate above the floor of the half it counts toward (B15 for the new
 * versions, B35 for the rest). With fewer than 15 / 35 charts in a half, its floor is 0.
 *
 * Charts already in their best 50 below SSS+ count too: an SSS+ there adds its rating less
 * what the chart is worth now.
 *
 * Of those, the ones players at their rating most often SSS+ (maishift's
 * stats, lib/recommend.ts), weighed by how much rating it would add: the top RECOMMENDED,
 * among charts at least MIN_PLAYERS of their band have a score on.
 *
 * Plain module (no database), so it can be tested on its own.
 */

/** One recommended chart, for the list on a profile (components/RecommendedCharts.tsx). */
export type RecommendedChart = {
  song: CatalogSong;
  chart: CatalogSong['charts'][number];
  pool: 'new' | 'old'; // which half of the best 50 it would join: B15 or B35
  gain: number; // how much their rating goes up with an SSS+ on it: its rating, less the floor it replaces (or, in the best 50, less what it's worth now)
  current: number | null; // their score on it when it's already in their best 50 (100.2 for 100.2%), else null
  share: number; // of the players at their rating with a score on it, how many have an SSS+ (0 to 1)
};

const RECOMMENDED = 30;
const MIN_PLAYERS = 10; // fewer, and the share of SSS+ is mostly luck

const difficultyIndex = (d: string) =>
  DIFFICULTY_ORDER.indexOf(String(d ?? '').toLowerCase().replace(/[^a-z]/g, '') as (typeof DIFFICULTY_ORDER)[number]);
const kindOf = (kind: string) => (/dx/i.test(kind ?? '') ? 1 : 0);

export function buildMyCharts(
  scores: Song[],
  catalog: CatalogSong[],
  band: BandStats | null = null,
): MyCharts & { floors: { new: number; old: number }; list: RecommendedChart[] } {
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
  // the best 50's own scores, by chart
  const inBest50 = new Map([...b15, ...b35].map((s) => [`${songForScore(songsByTitle, s)?.id}|${kindOf(s.kind)}|${difficultyIndex(s.difficulty)}`, s]));

  const candidates: (RecommendedChart & { bit: number; score: number })[] = [];
  for (const song of catalog) {
    const pool = song.version !== null && NEW_POOL_VERSIONS.includes(song.version) ? 'new' : 'old';
    const floor = floors[pool];
    for (const chart of song.charts) {
      const kind = chart.kind === 'dx' ? 1 : 0;
      const index = DIFFICULTY_ORDER.indexOf(chart.difficulty);
      const own = inBest50.get(`${song.id}|${kind}|${index}`);
      const best = rateSong({ achievement: RATING_CAP, internal_difficulty: chart.internal, ap: false } as Song);
      // in the best 50: what an SSS+ adds over its score now. otherwise: over the floor it'd replace
      const gain = own ? best - rateSong(own) : best - floor;
      if (gain <= 0) continue;

      const stat = band?.charts.get(chartKey(song.title, song.docArtist ?? song.artist, chart.kind, chart.difficulty))
        ?? band?.charts.get(chartKeyNoArtist(song.title, chart.kind, chart.difficulty));
      if (stat && stat.players >= MIN_PLAYERS && stat.sssPlus > 0) {
        const share = stat.sssPlus / stat.players;
        candidates.push({ song, chart, pool, gain, current: own ? Number(own.achievement) : null, share, bit: chartBit(kind, index), score: share * gain });
      }
    }
  }

  const top = candidates.sort((a, b) => b.score - a.score).slice(0, RECOMMENDED);
  const recommended: Record<string, number> = {};
  for (const c of top) recommended[c.song.id] = (recommended[c.song.id] ?? 0) | c.bit;
  const list = top.map(({ song, chart, pool, gain, current, share }) => ({ song, chart, pool, gain, current, share }));
  return { played, recommended, floors, list };
}
