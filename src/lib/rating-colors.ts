/**
 * A color (or a set of colors, for rainbow) for each of maimai's rating badges,
 * so things like the profile graph can match the player's badge.
 * Plain module, no 'use client': works on the server and in the browser.
 *
 * Tiers come from rating-tiers.ts, so the cutoffs only live in one place.
 */
import { RATING_TIERS } from './rating-tiers';

// colors: one for a solid line, several for a gradient along the line, left to right.
// text: what reads well on top of the first color (for the toggle button)
export type RatingColor = { colors: string[]; text: string };

const BY_TIER: Record<string, RatingColor> = {
  kiwami: { colors: ['#ff7eb3', '#ffb86b', '#fff07a', '#7ee7c4', '#7ab8ff', '#c58cff'], text: '#3a1030' },
  rainbow: { colors: ['#ff5a5a', '#ffb84d', '#f2e85a', '#5cd67f', '#4db8ff', '#a06bff'], text: '#3a1010' },
  platinum: { colors: ['#7fd8e6'], text: '#0b3a42' },
  gold: { colors: ['#e0a800'], text: '#3d2c00' },
  silver: { colors: ['#9aa7b8'], text: '#1d2530' },
  bronze: { colors: ['#c07a45'], text: '#fff' },
  purple: { colors: ['#a855f7'], text: '#fff' },
  red: { colors: ['#ef4444'], text: '#fff' },
  orange: { colors: ['#f97316'], text: '#fff' },
  green: { colors: ['#22c55e'], text: '#fff' },
  blue: { colors: ['#3b82f6'], text: '#fff' },
};

// under 1000 there's no colored badge
const NONE: RatingColor = { colors: ['#9ca3af'], text: '#111' };

export function ratingColor(rating: number | null | undefined): RatingColor {
  const tier = RATING_TIERS.find((t) => (rating ?? 0) >= t.min);
  return (tier && BY_TIER[tier.key]) ?? NONE;
}

// a CSS background for buttons and pills in that color
export function ratingBackground({ colors }: RatingColor) {
  return colors.length > 1 ? `linear-gradient(90deg, ${colors.join(', ')})` : colors[0];
}