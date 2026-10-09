import type { Song } from './leaderboard';

export const RATING_CAP = 100.5; // % above this doesn't add rating

/**
 * maimai DX's rating multiplier for each achievement, highest first: the first row
 * an achievement reaches is the one that applies.
 *
 * edge: a score of exactly 0.0001% under the next rank (100.4999, 99.9999, 98.9999,
 * 96.9999, 79.9999) gets a slightly higher multiplier than the rest of its rank. Those
 * rows only change the multiplier, they're not ranks of their own, so anything that
 * steps through ranks (the "next rank" hint) skips them.
 *
 * Below 10% earns nothing.
 */
export const RANK_CUTOFFS: Array<{ min: number; rank: string; factor: number; edge?: boolean }> = [
  { min: 100.5, rank: 'SSS+', factor: 0.224 },
  { min: 100.4999, rank: 'SSS', factor: 0.222, edge: true },
  { min: 100.0, rank: 'SSS', factor: 0.216 },
  { min: 99.9999, rank: 'SS+', factor: 0.214, edge: true },
  { min: 99.5, rank: 'SS+', factor: 0.211 },
  { min: 99.0, rank: 'SS', factor: 0.208 },
  { min: 98.9999, rank: 'S+', factor: 0.206, edge: true },
  { min: 98.0, rank: 'S+', factor: 0.203 },
  { min: 97.0, rank: 'S', factor: 0.2 },
  { min: 96.9999, rank: 'AAA', factor: 0.176, edge: true },
  { min: 94.0, rank: 'AAA', factor: 0.168 },
  { min: 90.0, rank: 'AA', factor: 0.152 },
  { min: 80.0, rank: 'A', factor: 0.136 },
  { min: 79.9999, rank: 'BBB', factor: 0.128, edge: true },
  { min: 75.0, rank: 'BBB', factor: 0.12 },
  { min: 70.0, rank: 'BB', factor: 0.112 },
  { min: 60.0, rank: 'B', factor: 0.096 },
  { min: 50.0, rank: 'C', factor: 0.08 },
  { min: 40.0, rank: 'D', factor: 0.064 },
  { min: 30.0, rank: 'D', factor: 0.048 },
  { min: 20.0, rank: 'D', factor: 0.032 },
  { min: 10.0, rank: 'D', factor: 0.016 },
];

export function rankFor(achievement: number | null) {
  if (achievement == null) return null;
  return RANK_CUTOFFS.find((c) => achievement >= c.min) ?? null;
}

/**
 * internal level x rank factor x achievement, floored, +1 for an AP or AP+.
 *
 * Done in whole numbers, the way the game stores them: level in tenths (13.7 -> 137),
 * achievement in ten-thousandths of a percent (100.2345% -> 1002345, capped at 1005000)
 * and the factor in thousandths (0.216 -> 216). In decimals, a result that should be
 * exactly a whole number can come out a hair under it (269.99999999999994) and floor
 * one point low; whole numbers can't. Same method as dxrating's calculateRatingAward.
 */
export function rateSong(song: Song): number {
  if (song.achievement == null || song.internal_difficulty == null) return 0;

  const units = Math.min(Math.round(RATING_CAP * 10000), Math.round(song.achievement * 10000));
  const cutoff = RANK_CUTOFFS.find((c) => units >= Math.round(c.min * 10000));
  if (!cutoff) return 0; // below 10% earns nothing

  const levelTenths = Math.round(song.internal_difficulty * 10);
  const factorThousandths = Math.round(cutoff.factor * 1000);
  // the three were scaled up by 10, 10000 and 1000, so the product is the rating x 1e8
  return Math.floor((levelTenths * units * factorThousandths) / 100_000_000) + (song.ap ? 1 : 0);
}

// returns copies with a rating attached, best first
function topRated(songs: Song[], count: number): Song[] {
  return songs
    .map((song) => ({ ...song, rating: rateSong(song) }))
    .filter((song) => song.rating > 0)
    .sort((a, b) => (b.rating - a.rating) || ((b.achievement ?? 0) - (a.achievement ?? 0)))
    .slice(0, count);
}

export function new15(songs: Song[]): Song[] {
  return topRated(songs.filter((song) => song.new_pool), 15);
}

export function old35(songs: Song[]): Song[] {
  return topRated(songs.filter((song) => !song.new_pool), 35);
}

export function calcRating(songs: Song[]): number {
  const sum = (list: Song[]) => list.reduce((total, song) => total + (Math.floor(song.rating)), 0);
  return sum(new15(songs)) + sum(old35(songs));
}