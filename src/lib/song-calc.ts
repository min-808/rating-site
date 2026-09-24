import type { Song } from './leaderboard';

const RATING_CAP = 100.5; // % above this doesn't add rating

const RANK_CUTOFFS = [
  { min: 100.5, rank: 'SSS+', factor: 0.224 },
  { min: 100.0, rank: 'SSS', factor: 0.216 },
  { min: 99.5, rank: 'SS+', factor: 0.211 },
  { min: 99.0, rank: 'SS', factor: 0.208 },
  { min: 98.0, rank: 'S+', factor: 0.203 },
  { min: 97.0, rank: 'S', factor: 0.2 },
  { min: 94.0, rank: 'AAA', factor: 0.168 },
  { min: 90.0, rank: 'AA', factor: 0.152 },
  { min: 80.0, rank: 'A', factor: 0.136 },
];

export function rankFor(achievement: number | null) {
  if (achievement == null) return null;
  return RANK_CUTOFFS.find((c) => achievement >= c.min) ?? null;
}

// internal level x rank factor x achievement, floored
export function rateSong(song: Song): number {
  if (song.achievement == null || song.internal_difficulty == null) return 0;

  const cutoff = rankFor(song.achievement);
  if (!cutoff) return 0; // below A earns nothing

  const capped = Math.min(song.achievement, RATING_CAP);
  return Math.floor(song.internal_difficulty * cutoff.factor * capped) + (song.ap ? 1 : 0); // calculation for rating (CC * factor * achievement)
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
  const sum = (list: Song[]) => list.reduce((total, song) => total + (Math.floor(song.rating) ?? 0), 0);
  return sum(new15(songs)) + sum(old35(songs));
}