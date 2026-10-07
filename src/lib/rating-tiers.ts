// maimai's rating badges and where each one starts, highest first. from 14000 up,
// each color is split further by star medals.
//
// this lives in its own plain module (no 'use client') so both the server-rendered
// leaderboard page and the client-side MilestoneBanner can import real values from it.
// anything exported from a 'use client' file arrives on the server as a stand-in
// reference, not the actual array, which is what broke MILESTONES.filter

export type RatingTier = { min: number; key: string; name: string; stars?: number };

export const RATING_TIERS: RatingTier[] = [
    { min: 16750, key: 'kiwami', name: 'Rainbow (Kiwami)', stars: 4 },
    { min: 16500, key: 'kiwami', name: 'Rainbow (Kiwami)', stars: 3 },
    { min: 16250, key: 'kiwami', name: 'Rainbow (Kiwami)', stars: 2 },
    { min: 16000, key: 'kiwami', name: 'Rainbow (Kiwami)', stars: 1 },
    { min: 15750, key: 'rainbow', name: 'Rainbow', stars: 4 },
    { min: 15500, key: 'rainbow', name: 'Rainbow', stars: 3 },
    { min: 15250, key: 'rainbow', name: 'Rainbow', stars: 2 },
    { min: 15000, key: 'rainbow', name: 'Rainbow', stars: 1 },
    { min: 14750, key: 'platinum', name: 'Platinum', stars: 2 },
    { min: 14500, key: 'platinum', name: 'Platinum', stars: 1 },
    { min: 14250, key: 'gold', name: 'Gold', stars: 2 },
    { min: 14000, key: 'gold', name: 'Gold', stars: 1 },
    { min: 13000, key: 'silver', name: 'Silver' },
    { min: 12000, key: 'bronze', name: 'Bronze' },
    { min: 10000, key: 'purple', name: 'Purple' },
    { min: 7000, key: 'red', name: 'Red' },
    { min: 4000, key: 'orange', name: 'Orange' },
    { min: 2000, key: 'green', name: 'Green' },
    { min: 1000, key: 'blue', name: 'Blue' },
];

// every badge boundary, so the leaderboard can announce each one
export const TIER_MILESTONES = RATING_TIERS.map((t) => t.min);

// the badge for a milestone, only when it's exactly where that badge starts
export function tierAt(milestone: number) {
    return RATING_TIERS.find((t) => t.min === milestone) ?? null;
}

// "Rainbow (Kiwami) 2★", or just "Silver" for badges without stars
export function tierLabel(tier: RatingTier) {
    return tier.stars ? `${tier.name} ${tier.stars}★` : tier.name;
}