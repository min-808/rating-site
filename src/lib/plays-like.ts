import { ratingGroup, ratingGroupStart, RATING_GROUP_SIZE } from './comfort-level';
import { RATING_CAP, rateSong } from './song-calc';
import type { Song } from './leaderboard';
import type { MaishiftDetail } from './maishift-feel';

/**
 * How hard a chart plays compared with its constant ("plays like 13.1"), from the scores on
 * this site. Plain module (no database), so it can be tested on its own. The results are
 * saved, not worked out on every page view: lib/chart-feel-store.ts. The song page's
 * "how is this worked out?" popup explains the same steps in words (components/SongPageView.tsx).
 *
 * Stage 1, each chart on its own (chartGaps):
 *   1. who counts: players whose rating is within GROUPS_EACH_SIDE rating groups of the
 *      chart's center rating (every rating above ALL_PLAYERS_ABOVE), with at least
 *      MIN_BASELINE_CHARTS of their own other scores within 0.2 of the constant
 *   2. each player's gap: their score here minus their usual score (their average on those
 *      other charts). Scores under 94% count as 94% (SCORE_FLOOR). Each player is compared
 *      with themselves, so it doesn't matter who happened to play the chart
 *   3. the chart's average gap, and each rating group's, for the bars (no names)
 *
 * Stage 2, the charts against each other (finishFeels):
 *   4. popularity: charts more people play get practised more and score higher. The gap
 *      gained per doubling of players (beta) is measured across all charts, and taken back
 *      out: adjusted gap = gap - beta x (log2 players - the comparison charts' average)
 *   5. comparison: the chart's adjusted gap against charts from the same era (ERAS) within
 *      0.1 of its constant, as a z score: (adjusted gap - their mean) / their spread.
 *      Positive: players score above their usual here, so it's easier
 *   6. plays like = constant - z x K, moved at most CAP, never above MAX_CONSTANT
 *
 * With fewer than MIN_PLAYERS counted it's still worked out (from one player up), marked
 * lowSample so the page says it may be inaccurate; SHOW_WITH_FEW_PLAYERS = false hides it.
 */

/** Scores below this count as this (AAA), in a player's usual score and on the chart: fails and first tries. */
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
/** How strongly the comparison moves the constant: plays like = constant - z x K. */
export const K = 0.2;
/** The most "plays like" can move from the real constant, either way. */
export const CAP = 0.5;
/** The hardest constant in the game (15.0 for now): "plays like" never goes above it. Also caps the center rating. */
export const MAX_CONSTANT = 15.0;
/** A chart needs this many counted players to be part of other charts' comparison (its own result needs one). */
const MIN_PLAYERS_TO_COMPARE = 3;
/** A comparison needs this many charts; with fewer, it widens (see comparisonFor). */
const MIN_COMPARISON_CHARTS = 5;
/** A comparison's spread is never taken as smaller than this (%), so a few near-identical charts can't blow z up. */
const MIN_SPREAD = 0.1;

/**
 * The eras charts are compared within: charts from recent versions score much higher than
 * old ones at the same constant (seen in maishift's data), so a new chart is only compared
 * with other new ones. By version code (lib/versions.ts).
 */
export const ERAS = [
  { from: 23000, label: 'FESTiVAL and later' },
  { from: 20000, label: 'DX to UNiVERSE PLUS' },
  { from: 0, label: 'maimai to FiNALE' },
] as const;
const eraOf = (versionCode: number | null) => ERAS.findIndex((e) => (versionCode ?? 0) >= e.from);

/** A chart's center rating: an SSS+ on it (no AP) x 50, the game's own rounding, capped. 13.5 -> 15,150. */
export function centerRating(constant: number): number {
  const sssPlus = rateSong({ achievement: RATING_CAP, internal_difficulty: Math.min(constant, MAX_CONSTANT), ap: false } as Song);
  return Math.min(sssPlus * 50, MAX_CENTER_RATING);
}

/**
 * One player's scores summed by constant: tenths of constant ("141" for 14.1) -> [sum of
 * accuracy, number of charts]. Their rating places them in a group.
 */
export type PlayerBaseline = { rating: number; byConstant: Record<string, [number, number]> };

export type ChartFeelGroup = {
  from: number; // the group's lowest rating, 13,250
  to: number; // its highest, 13,499
  players: number;
  averageGap: number; // percentage points, -0.62
};

/** How "plays like" came out, step by step, for the popup. Rounded for display. */
export type ChartFeelWorking = {
  averageGap: number; // step 3
  scored: number; // players with any score on the chart (popularity)
  perDoubling: number; // beta, % per doubling of players
  adjustedGap: number; // step 4
  comparisonCharts: number; // step 5: how many charts it was compared with
  comparisonFrom: number; // their constants: from...
  comparisonTo: number; // ...to
  comparisonEra: string; // "FESTiVAL and later", or "all versions" when it had to widen
  comparisonMean: number;
  comparisonSpread: number;
  z: number;
  k: number;
  cap: number;
};

export type ChartFeel = {
  needed: number; // MIN_PLAYERS
  counted: number; // players who count (in range, with a usual score)
  allRatings: boolean; // above ALL_PLAYERS_ABOVE: every rating counts, and ratingFrom / ratingTo are just the ratings of those who did
  ratingFrom: number; // the ratings that count: from...
  ratingTo: number; // ...to
  baselineFrom: number; // the constants a usual score is made from: 13.9...
  baselineTo: number; // ...14.3
  playsLike: number | null; // 13.1, or null when nobody counts (or fewer than MIN_PLAYERS with SHOW_WITH_FEW_PLAYERS off)
  lowSample: boolean; // fewer than MIN_PLAYERS counted: shown, but may be inaccurate
  groups: ChartFeelGroup[]; // lowest rating first, only groups with players
  working?: ChartFeelWorking; // how playsLike came out, when there is one (this site's data)
  source?: 'site' | 'maishift'; // where it came from. missing: this site's players (older saved results)
  maishift?: MaishiftDetail; // maishift's numbers, when it came from there (lib/maishift-feel.ts)
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

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** Stage 1's result for one chart: everything but playsLike / working, plus what stage 2 needs. */
export type ChartGaps = ChartFeel & { constant: number; versionCode: number | null; scored: number; averageGap: number | null };

/** Stage 1: one chart's players and their gaps (steps 1-3). */
export function chartGaps(
  constant: number,
  versionCode: number | null,
  scores: Array<{ webId: number; achievement: number }>,
  baselines: Record<string, PlayerBaseline>,
): ChartGaps {
  const tenth = Math.round(constant * 10);
  const ownGroup = ratingGroup(centerRating(constant));
  const allRatings = constant > ALL_PLAYERS_ABOVE;
  const lowestGroup = ownGroup - GROUPS_EACH_SIDE;
  const highestGroup = ownGroup + GROUPS_EACH_SIDE;

  const gaps: Array<{ group: number; gap: number }> = [];
  for (const { webId, achievement } of scores) {
    const baseline = baselines[webId];
    if (!baseline || !(achievement > 0)) continue;
    const score = Math.max(SCORE_FLOOR, achievement); // like the scores in their sums (lib/player-baselines.ts)
    const group = ratingGroup(baseline.rating);
    if (!allRatings && (group < lowestGroup || group > highestGroup)) continue; // the chart isn't in their range
    const usual = averageOver(baseline, tenth - BASELINE_TENTHS, tenth + BASELINE_TENTHS, { tenth, achievement: score });
    if (!usual || usual.charts < MIN_BASELINE_CHARTS) continue; // not enough of their own charts near this level
    gaps.push({ group, gap: score - usual.average });
  }

  // every rating counts above ALL_PLAYERS_ABOVE: the range shown is the ratings of those who counted
  const countedGroups = gaps.map((g) => g.group);
  const fromGroup = allRatings && gaps.length ? Math.min(...countedGroups) : lowestGroup;
  const toGroup = allRatings && gaps.length ? Math.max(...countedGroups) : highestGroup;
  const byGroup = new Map<number, number[]>();
  for (const { group, gap } of gaps) byGroup.set(group, [...(byGroup.get(group) ?? []), gap]);

  return {
    constant,
    versionCode,
    scored: scores.filter((s) => s.achievement > 0).length,
    averageGap: gaps.length ? gaps.reduce((t, g) => t + g.gap, 0) / gaps.length : null,
    needed: MIN_PLAYERS,
    counted: gaps.length,
    allRatings,
    ratingFrom: ratingGroupStart(fromGroup),
    ratingTo: ratingGroupStart(toGroup) + RATING_GROUP_SIZE - 1,
    baselineFrom: (tenth - BASELINE_TENTHS) / 10,
    baselineTo: (tenth + BASELINE_TENTHS) / 10,
    playsLike: null,
    lowSample: gaps.length < MIN_PLAYERS,
    groups: [...byGroup]
      .sort(([a], [b]) => a - b)
      .map(([group, list]) => ({
        from: ratingGroupStart(group),
        to: ratingGroupStart(group) + RATING_GROUP_SIZE - 1,
        players: list.length,
        averageGap: round(list.reduce((t, g) => t + g, 0) / list.length, 3),
      })),
  };
}

const log2 = (n: number) => Math.log2(Math.max(1, n));
const mean = (values: number[]) => values.reduce((t, v) => t + v, 0) / values.length;
const spread = (values: number[]) => {
  const m = mean(values);
  return Math.sqrt(values.reduce((t, v) => t + (v - m) ** 2, 0) / values.length);
};

/**
 * Stage 2: every chart's playsLike (steps 4-6). Takes every chart's stage 1, returns the same
 * charts' finished results in the same order.
 */
export function finishFeels(charts: ChartGaps[]): ChartFeel[] {
  const comparable = charts.filter((c) => c.averageGap != null && c.counted >= MIN_PLAYERS_TO_COMPARE);
  const tenthOf = (c: ChartGaps) => Math.round(c.constant * 10);

  // step 4: gap gained per doubling of players, measured within each era and constant, pooled
  const cells = new Map<string, ChartGaps[]>();
  for (const c of comparable) {
    const key = `${eraOf(c.versionCode)}|${tenthOf(c)}`;
    cells.set(key, [...(cells.get(key) ?? []), c]);
  }
  let sxy = 0;
  let sxx = 0;
  for (const cell of cells.values()) {
    if (cell.length < 2) continue;
    const mx = mean(cell.map((c) => log2(c.scored)));
    const my = mean(cell.map((c) => c.averageGap!));
    for (const c of cell) {
      sxy += (log2(c.scored) - mx) * (c.averageGap! - my);
      sxx += (log2(c.scored) - mx) ** 2;
    }
  }
  // only ever counted one way: more players, more practice, higher scores. no effect seen: none applied
  const perDoubling = sxx > 0 ? Math.max(0, sxy / sxx) : 0;

  // step 5: who a chart is compared with: the same era within 0.1, widening to 0.2, then to every era
  const comparisonFor = (c: ChartGaps) => {
    const era = eraOf(c.versionCode);
    const near = (reach: number, anyEra: boolean) =>
      comparable.filter((o) => Math.abs(tenthOf(o) - tenthOf(c)) <= reach && (anyEra || eraOf(o.versionCode) === era));
    for (const [reach, anyEra] of [[1, false], [2, false], [2, true]] as const) {
      const list = near(reach, anyEra);
      if (list.length >= MIN_COMPARISON_CHARTS) return { list, reach, anyEra };
    }
    return null;
  };

  return charts.map((c) => {
    const { constant: _c, versionCode: _v, scored: _s, averageGap, ...feel } = c;
    const result: ChartFeel = { ...feel, playsLike: null };
    if (averageGap == null || (c.lowSample && !SHOW_WITH_FEW_PLAYERS)) return result;
    const comparison = comparisonFor(c);
    if (!comparison) return result; // nothing to compare it with yet: no plays like

    const { list, reach, anyEra } = comparison;
    const averageLog = mean(list.map((o) => log2(o.scored)));
    const adjust = (o: ChartGaps) => o.averageGap! - perDoubling * (log2(o.scored) - averageLog);
    const adjusted = list.map(adjust);
    const comparisonMean = mean(adjusted);
    const comparisonSpread = Math.max(MIN_SPREAD, spread(adjusted));
    const adjustedGap = adjust(c);
    const z = (adjustedGap - comparisonMean) / comparisonSpread;
    const move = Math.max(-CAP, Math.min(CAP, -z * K));

    return {
      ...result,
      playsLike: Math.min(MAX_CONSTANT, Math.round((c.constant + move) * 10) / 10),
      working: {
        averageGap: round(averageGap, 3),
        scored: c.scored,
        perDoubling: round(perDoubling, 3),
        adjustedGap: round(adjustedGap, 3),
        comparisonCharts: list.length,
        comparisonFrom: (tenthOf(c) - reach) / 10,
        comparisonTo: (tenthOf(c) + reach) / 10,
        comparisonEra: anyEra ? 'all versions' : ERAS[eraOf(c.versionCode)].label,
        comparisonMean: round(comparisonMean, 3),
        comparisonSpread: round(comparisonSpread, 3),
        z: round(z, 2),
        k: K,
        cap: CAP,
      },
    };
  });
}
