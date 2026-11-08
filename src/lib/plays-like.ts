import { ratingGroup, ratingGroupStart, RATING_GROUP_SIZE } from './comfort-level';
import { RATING_CAP, rateSong } from './song-calc';
import type { Song } from './leaderboard';

/**
 * How hard a chart plays compared with its constant ("plays like 14.4"), from the scores on
 * this site. Plain module (no database), so it can be tested on its own; the scores come
 * from lib/song-records.ts and each player's usual scores from lib/player-baselines.ts.
 *
 * For each player with a score on the chart:
 *   1. their usual score: their average accuracy on their OTHER charts within 0.2 of this
 *      chart's constant (a 14.1 uses their 13.9 to 14.3 charts). Scores under 94% count as
 *      94% here and on the chart (SCORE_FLOOR)
 *   2. their gap: their score here minus their usual score. usually 100.3% on 14.1s and
 *      99.6% here: -0.7%
 * Each player is compared with themselves, so it doesn't matter whether strong or weak
 * players happened to play the chart.
 *
 * Only players the chart is in range for count: a 16k player gets about 100.7% on almost any
 * level 12, so every level 12 would look the same to them. A chart's center rating is what
 * an SSS+ on it is worth x 50 (a 13.5: 303 x 50 = 15,150), capped at MAX_CENTER_RATING and
 * a constant of MAX_CONSTANT. Its "own" rating group is the one holding that center; only
 * players within GROUPS_EACH_SIDE groups of it count (a 13.5 counts 14,250 to 15,999).
 * Charts above ALL_PLAYERS_ABOVE are the exception: few players play them, so everyone with
 * a usual score near that level counts, whatever their rating.
 *
 * The result:
 *   - each rating group's average gap, for the bars (no names: a group is only an average)
 *   - "plays like": the constant those players would usually score this on. The average gap
 *     turned into constant using how fast their own scores drop as charts get harder
 *     (their usual score half a level above vs half a level below), then only half of that
 *     change is kept (CHANGE_KEPT): halfway between the calculated constant and the real one
 * With fewer than MIN_PLAYERS players it's still worked out (as long as one player counts),
 * and marked lowSample so the page says it may be inaccurate. SHOW_WITH_FEW_PLAYERS = false
 * switches that off: then nothing is shown until MIN_PLAYERS players count.
 *
 * The results are saved, not worked out on every page view: lib/chart-feel-store.ts.
 */

/**
 * Scores below this count as this (AAA), both in a player's usual score and on the chart.
 * Below it is mostly fails and first tries, and a few of those would drag a player's usual
 * score far down and make every chart they've practised look easy.
 */
export const SCORE_FLOOR = 94;

/** The highest center rating a chart can have. (The real max rating is 16,663 to 16,690 depending on the version.) */
export const MAX_CENTER_RATING = 16600;
/** Charts above this constant count every player, not only those near the chart's level. */
export const ALL_PLAYERS_ABOVE = 14.0;

/** How many players it takes for "plays like" to be trusted. */
export const MIN_PLAYERS = 8;
/** true: with fewer than MIN_PLAYERS, still show it, marked as maybe inaccurate. false: show nothing until there are MIN_PLAYERS. */
export const SHOW_WITH_FEW_PLAYERS = true;
/** Rating groups on each side of the chart's own group that still count. */
export const GROUPS_EACH_SIDE = 3;
/** How far either side of the constant a player's other charts can be to make their usual score (in tenths: 0.2). */
const BASELINE_TENTHS = 2;
/** How many other charts near the constant a player needs for a usual score. */
const MIN_BASELINE_CHARTS = 3;
/** If players' own scores don't say how fast accuracy drops per 1.0 of constant, this is used (in %). */
const FALLBACK_DROP_PER_LEVEL = -0.8;
/** "Plays like" never strays further than this from the real constant. */
const MAX_OFFSET = 1.5;
/**
 * How much of the calculated change is kept: 0.5 = halfway between the calculated constant
 * and the real one. With few players the full change over- and under-rates charts too
 * hard, so it's halved; raise it toward 1 as more scores come in.
 */
export const CHANGE_KEPT = 0.5;
/** ...and never goes above the hardest constant in the game (15.0 for now). Also the cap on the constant a center rating is worked out from. */
export const MAX_CONSTANT = 15.0;

/** A chart's center rating: an SSS+ on it (no AP) x 50, the game's own rounding, capped. 13.5 -> 15,150. */
export function centerRating(constant: number): number {
  const sssPlus = rateSong({ achievement: RATING_CAP, internal_difficulty: Math.min(constant, MAX_CONSTANT), ap: false } as Song);
  return Math.min(sssPlus * 50, MAX_CENTER_RATING);
}

/**
 * One player's scores, summed by constant: tenths of constant ("141" for 14.1) -> [sum of
 * accuracy, number of charts]. Their rating places them in a group.
 */
export type PlayerBaseline = { rating: number; byConstant: Record<string, [number, number]> };

export type ChartFeelGroup = {
  from: number; // the group's lowest rating, 13,250
  to: number; // its highest, 13,499
  players: number;
  averageGap: number; // percentage points, -0.62
};

export type ChartFeel = {
  needed: number; // MIN_PLAYERS
  counted: number; // players who count (in range, with a usual score)
  allRatings: boolean; // above ALL_PLAYERS_ABOVE: every rating counts, and ratingFrom / ratingTo are just the ratings of those who did
  ratingFrom: number; // the ratings that count: from...
  ratingTo: number; // ...to
  baselineFrom: number; // the constants a usual score is made from: 13.9...
  baselineTo: number; // ...14.3
  playsLike: number | null; // 14.4, or null when nobody counts (or fewer than MIN_PLAYERS with SHOW_WITH_FEW_PLAYERS off)
  lowSample: boolean; // fewer than MIN_PLAYERS counted: shown, but may be inaccurate
  groups: ChartFeelGroup[]; // lowest rating first, only groups with players. empty when playsLike is null
};

/** A player's average accuracy over a range of tenths of constant, leaving one score out. */
function averageOver(
  baseline: PlayerBaseline, fromTenth: number, toTenth: number,
  leaveOut?: { tenth: number; achievement: number },
): { average: number; charts: number } | null {
  let sum = 0;
  let charts = 0;
  for (let t = fromTenth; t <= toTenth; t++) {
    const entry = baseline.byConstant[t];
    if (!entry) continue;
    sum += entry[0];
    charts += entry[1];
  }
  // this chart's own score is in their sums: take it out, so it isn't compared with itself
  if (leaveOut && leaveOut.tenth >= fromTenth && leaveOut.tenth <= toTenth && (baseline.byConstant[leaveOut.tenth]?.[1] ?? 0) > 0) {
    sum -= leaveOut.achievement;
    charts -= 1;
  }
  return charts > 0 ? { average: sum / charts, charts } : null;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** How one chart plays, from everyone's score on it and their usual scores. */
export function chartFeel(
  constant: number,
  scores: Array<{ webId: number; achievement: number }>,
  baselines: Record<string, PlayerBaseline>,
): ChartFeel {
  const tenth = Math.round(constant * 10);
  const center = centerRating(constant);
  const ownGroup = ratingGroup(center);
  const allRatings = constant > ALL_PLAYERS_ABOVE;
  const lowestGroup = ownGroup - GROUPS_EACH_SIDE;
  const highestGroup = ownGroup + GROUPS_EACH_SIDE;

  const gaps: Array<{ group: number; gap: number }> = [];
  const drops: number[] = []; // per player: how much their usual score drops from half a level below to half above
  for (const { webId, achievement } of scores) {
    const baseline = baselines[webId];
    if (!baseline || !(achievement > 0)) continue;
    const score = Math.max(SCORE_FLOOR, achievement); // like the scores in their sums (lib/player-baselines.ts)
    const group = ratingGroup(baseline.rating);
    if (!allRatings && (group < lowestGroup || group > highestGroup)) continue; // the chart isn't in their range

    const usual = averageOver(baseline, tenth - BASELINE_TENTHS, tenth + BASELINE_TENTHS, { tenth, achievement: score });
    if (!usual || usual.charts < MIN_BASELINE_CHARTS) continue; // not enough of their own charts near this level
    gaps.push({ group, gap: score - usual.average });

    const below = averageOver(baseline, tenth - 5 - BASELINE_TENTHS, tenth - 5 + BASELINE_TENTHS);
    const above = averageOver(baseline, tenth + 5 - BASELINE_TENTHS, tenth + 5 + BASELINE_TENTHS);
    if (below && above && below.charts >= 2 && above.charts >= 2) drops.push(above.average - below.average);
  }

  // every rating counts above ALL_PLAYERS_ABOVE: the range shown is the ratings of those who counted
  const countedGroups = gaps.map((g) => g.group);
  const fromGroup = allRatings && gaps.length ? Math.min(...countedGroups) : lowestGroup;
  const toGroup = allRatings && gaps.length ? Math.max(...countedGroups) : highestGroup;
  const result: ChartFeel = {
    needed: MIN_PLAYERS,
    counted: gaps.length,
    allRatings,
    ratingFrom: ratingGroupStart(fromGroup),
    ratingTo: ratingGroupStart(toGroup) + RATING_GROUP_SIZE - 1,
    baselineFrom: (tenth - BASELINE_TENTHS) / 10,
    baselineTo: (tenth + BASELINE_TENTHS) / 10,
    playsLike: null,
    lowSample: gaps.length < MIN_PLAYERS,
    groups: [],
  };
  if (gaps.length === 0 || (gaps.length < MIN_PLAYERS && !SHOW_WITH_FEW_PLAYERS)) return result;

  const averageGap = gaps.reduce((total, g) => total + g.gap, 0) / gaps.length;
  // how many % accuracy one level of constant costs these players. it should be negative
  // (harder charts, lower scores); if their scores don't show that clearly, use the fallback
  const dropPerLevel = drops.length >= 3 && median(drops) < -0.15 ? median(drops) : FALLBACK_DROP_PER_LEVEL;
  const offset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, averageGap / dropPerLevel));

  const byGroup = new Map<number, number[]>();
  for (const { group, gap } of gaps) byGroup.set(group, [...(byGroup.get(group) ?? []), gap]);

  // the calculated constant, then only CHANGE_KEPT of the way from the real constant to it
  const calculated = Math.min(MAX_CONSTANT, constant + offset);
  result.playsLike = Math.min(MAX_CONSTANT, Math.round((constant + (calculated - constant) * CHANGE_KEPT) * 10) / 10);
  result.groups = [...byGroup]
    .sort(([a], [b]) => a - b)
    .map(([group, list]) => ({
      from: ratingGroupStart(group),
      to: ratingGroupStart(group) + RATING_GROUP_SIZE - 1,
      players: list.length,
      averageGap: list.reduce((total, g) => total + g, 0) / list.length,
    }));
  return result;
}
