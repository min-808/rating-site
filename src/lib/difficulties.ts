// the game's chart difficulties, in order, as the scraper names them on each chart.
// a plain module (no 'use client'), so server pages get the real list: anything exported
// from a 'use client' file reaches the server as a stand-in, not the actual array
export const CHART_DIFFICULTIES = ['basic', 'advanced', 'expert', 'master', 'remaster'] as const;

// played / total charts per difficulty
export type DifficultyCounts = Record<string, { played: number; total: number }>;
