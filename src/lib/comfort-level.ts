import { RATING_CAP, rateSong } from './song-calc';
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
