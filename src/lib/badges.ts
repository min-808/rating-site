import type { Song } from './leaderboard';

/**
 * Rank, combo and sync badge images (the same files BestFifty.tsx uses), in a plain module
 * so server pages can use them too: anything exported from a 'use client' file reaches the
 * server as a stand-in, not the real value.
 */

export const BADGE_BASE = 'https://img.himaimai.net/badge';

// "SSS+" -> https://img.himaimai.net/badge/sssp.png
export const rankImage = (rank: string) => `${BADGE_BASE}/${rank.toLowerCase().replace(/\+/g, 'p')}.png`;

const COMBO: Record<string, { label: string; file: string }> = {
  fc: { label: 'FC', file: 'fc' },
  fcplus: { label: 'FC+', file: 'fcp' },
  ap: { label: 'AP', file: 'ap' },
  app: { label: 'AP+', file: 'app' },
  applus: { label: 'AP+', file: 'app' },
};
const SYNC: Record<string, { label: string; file: string }> = {
  fs: { label: 'FS', file: 'fs' },
  fsplus: { label: 'FS+', file: 'fsp' },
  fdx: { label: 'FDX', file: 'fdx' },
  fdxplus: { label: 'FDX+', file: 'fdxp' },
};

// the chart's combo badge (FC, FC+, AP, AP+), or null
export function comboBadge(song: Pick<Song, 'fc' | 'ap'>) {
  const c = COMBO[(song.fc || (song.ap ? 'ap' : '')).toLowerCase().replace(/[^a-z]/g, '')];
  return c ? { label: c.label, src: `${BADGE_BASE}/${c.file}.png` } : null;
}

// the chart's sync badge (FS, FS+, FDX, FDX+), or null. plain SYNC has no image
export function syncBadge(song: Pick<Song, 'fs'>) {
  const s = SYNC[(song.fs || '').toLowerCase().replace(/[^a-z]/g, '')];
  return s ? { label: s.label, src: `${BADGE_BASE}/${s.file}.png` } : null;
}

// a combo or sync row's badge image, by its label ("AP+", "FDX"). plain SYNC has none
const BADGE_FILE: Record<string, string> = {
  'AP+': 'app', AP: 'ap', 'FC+': 'fcp', FC: 'fc', 'FDX+': 'fdxp', FDX: 'fdx', 'FS+': 'fsp', FS: 'fs',
};
export const badgeImageFor = (label: string) => (BADGE_FILE[label] ? `${BADGE_BASE}/${BADGE_FILE[label]}.png` : null);
