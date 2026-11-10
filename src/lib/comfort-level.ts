import { RATING_CAP, RANK_CUTOFFS, rateSong } from './song-calc';
import type { Song } from './leaderboard';

/**
 * A player's comfort level: the constant where an SSS+ is worth about as much as their
 * average best-50 chart. Their rating is the sum of 50 charts, so rating / 50 is what an
 * average one of those is worth, and an SSS+ (100.5%) on a chart is worth its constant x
 * 22.512. So the comfort level is rating / 50 / 22.512:
 *   13,000 rating -> 11.5    15,000 -> 13.3    16,000 -> 14.2
 *
 * Used two ways: on a player's own profile (components/ComfortLevel.tsx), and on a song's
 * page, to only count the players a chart is in range for (lib/plays-like.ts). Plain module.
 */

/** What an SSS+ is worth per 1.0 of constant: 100.5 x 0.224 = 22.512. */
export const SSS_PLUS_RATING_PER_CONSTANT = (RATING_CAP / 100) * 22.4;

/** The width of a rating group on the song pages ("13,250–13,499"). */
export const RATING_GROUP_SIZE = 250;

/** The comfort level for a rating: 15,000 -> 13.33. */
export const comfortLevel = (rating: number) => rating / 50 / SSS_PLUS_RATING_PER_CONSTANT;

/** Which rating group a rating falls in, counted in RATING_GROUP_SIZE steps: 13,300 -> 53 (13,250–13,499). */
export const ratingGroup = (rating: number) => Math.floor(rating / RATING_GROUP_SIZE);

/** A rating group's lowest rating: group 53 -> 13,250. */
export const ratingGroupStart = (group: number) => group * RATING_GROUP_SIZE;

/** A constant rounded down to one decimal, the way the game shows them: 13.36 -> 13.3. */
export const toTenth = (value: number) => Math.floor(value * 10 + 1e-9) / 10;

/**
 * The lowest constant where an SSS+ (no AP) would rate above `floor`, the weakest chart in
 * a best-15 / best-35. null when a half isn't full yet (floor 0: anything counts) or nothing
 * up to 15.0 would beat it.
 */
export function constantToBeat(floor: number): number | null {
  if (floor <= 0) return null;
  for (let tenths = 10; tenths <= 150; tenths++) {
    const rating = rateSong({ achievement: RATING_CAP, internal_difficulty: tenths / 10, ap: false } as Song);
    if (rating > floor) return tenths / 10;
  }
  return null;
}

/** How wide each suggested range is, in constant. */
const COMFORT_ZONE_BELOW = 0.5; // the comfort zone: from this far below the comfort level, up to it
const PUSH_ABOVE = 0.8; // "push for": from just above the comfort level, up this far

export type ComfortSummary = {
  level: number; // 13.3
  comfortZone: [number, number]; // [12.8, 13.3]: charts at their level, for scoring consistently
  push: [number, number]; // [13.4, 14.1]: a little above it, where their rating grows
  raiseNew: number | null; // an SSS+ on a new-version chart from this constant beats their weakest B15 chart
  raiseOld: number | null; // the same for the older versions and their B35
};

/** Everything the profile's comfort card shows, from the rating and the two floors (lib/my-charts.ts). */
export function comfortSummary(rating: number, floors: { new: number; old: number }): ComfortSummary {
  const level = toTenth(comfortLevel(rating));
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    level,
    comfortZone: [round(level - COMFORT_ZONE_BELOW), level],
    push: [round(level + 0.1), round(level + PUSH_ABOVE)],
    raiseNew: constantToBeat(floors.new),
    raiseOld: constantToBeat(floors.old),
  };
}

export type AccuracyTarget =
  | { reachable: true; achievement: number; rank: string; perChart: number } // aim for this (rounded up to 0.01%)
  | { reachable: false; best: number; perChart: number }; // even an SSS+ (best) is worth less than perChart

/**
 * The accuracy to aim for on a chart at a rating: the lowest score that makes it worth as
 * much as that rating's average best-50 chart (rating / 50, rounded up). Uses the game's own
 * rating formula (lib/song-calc.ts rateSong) and the chart's real constant, since that's what
 * the game rates. No AP bonus. A 13.3 at 15,000 rating: worth 300 a chart, so an SSS+ is
 * needed and still falls short (299): not reachable.
 */
export function accuracyTarget(constant: number, rating: number): AccuracyTarget {
  const perChart = Math.ceil(rating / 50);
  const worth = (achievement: number) => rateSong({ achievement, internal_difficulty: constant, ap: false } as Song);
  // the ranks lowest first, skipping the single-score "edge" rows (100.4999% and the like)
  const ranks = RANK_CUTOFFS.filter((r) => !r.edge).slice().reverse();
  for (let i = 0; i < ranks.length; i++) {
    const rank = ranks[i];
    const nextMin = i + 1 < ranks.length ? ranks[i + 1].min : RATING_CAP + 1e-9;
    // within a rank the rating only grows with accuracy: the least accuracy giving perChart, in 0.0001% steps
    const units = Math.ceil((perChart * 100_000_000) / (Math.round(constant * 10) * Math.round(rank.factor * 1000)));
    let achievement = Math.max(rank.min, units / 10000);
    achievement = Math.ceil(achievement * 100 - 1e-9) / 100; // shown to 0.01%, rounded up so it's still enough
    if (achievement < nextMin && achievement <= RATING_CAP && worth(achievement) >= perChart) {
      return { reachable: true, achievement, rank: rank.rank, perChart };
    }
  }
  return { reachable: false, best: worth(RATING_CAP), perChart };
}

/**
 * The other way round from accuracyTarget: the rating a score on this chart suits, the one
 * whose average best-50 chart (rating / 50) it's worth. SSS (100%) on a 13.3: 287 x 50 = 14,350.
 */
export function ratingForAccuracy(constant: number, achievement: number): { rating: number; perChart: number } {
  const perChart = rateSong({ achievement, internal_difficulty: constant, ap: false } as Song);
  return { rating: perChart * 50, perChart };
}
