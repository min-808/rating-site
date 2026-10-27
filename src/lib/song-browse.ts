import { songMatcher } from './song-search';
import { toNormalWidth } from './leaderboard';

/**
 * Searching and filtering the song list (/songs). Plain module, so it runs in the browser
 * (the list filters as you type) and can be tested on its own.
 */

export const DIFFICULTY_ORDER = ['basic', 'advanced', 'expert', 'master', 'remaster'] as const;

// kind: 1 is a DX chart, 0 a standard one. difficulty: index into DIFFICULTY_ORDER
export type BrowserChart = [kind: 0 | 1, difficulty: number, internal: number];

export type BrowserSong = {
  id: string;
  title: string;
  romaji: string | null;
  artist: string | null;
  genre: string | null;
  version: string | null;
  versionCode: number | null;
  jacket: string | null;
  na: boolean;
  bpm: number | null;
  charts: BrowserChart[];
};

/** A constant as the game shows its level: 13.7 -> "13+", 13.4 -> "13", 6.5 -> "6". */
export function gameLevel(internal: number): string {
  if (internal < 7) return String(Math.floor(internal));
  const whole = Math.floor(internal + 1e-9);
  return Math.round((internal - whole) * 10) >= 6 ? `${whole}+` : String(whole);
}

export const LEVEL_OPTIONS = [
  '1', '2', '3', '4', '5', '6', '7', '7+', '8', '8+', '9', '9+', '10', '10+',
  '11', '11+', '12', '12+', '13', '13+', '14', '14+', '15',
];

export type BrowseFilters = {
  query: string;
  genre: string; // '' = any
  version: string; // a version's name, '' = any
  level: string; // "13+", '' = any
  difficulty: string; // "master", '' = any
  kind: '' | 'dx' | 'standard';
  region: 'na' | 'intl';
  sort: 'title' | 'newest' | 'level';
};

export const DEFAULT_FILTERS: BrowseFilters = {
  query: '', genre: '', version: '', level: '', difficulty: '', kind: '', region: 'na', sort: 'title',
};

const fold = (text: string) => toNormalWidth(text ?? '').normalize('NFKC').toLowerCase();

/** The charts of a song that pass the kind / difficulty / level filters. */
export function matchingCharts(song: BrowserSong, f: BrowseFilters): BrowserChart[] {
  const diffIndex = f.difficulty ? DIFFICULTY_ORDER.indexOf(f.difficulty as (typeof DIFFICULTY_ORDER)[number]) : -1;
  return song.charts.filter(([kind, difficulty, internal]) => {
    if (f.kind === 'dx' && kind !== 1) return false;
    if (f.kind === 'standard' && kind !== 0) return false;
    if (diffIndex >= 0 && difficulty !== diffIndex) return false;
    if (f.level && gameLevel(internal) !== f.level) return false;
    return true;
  });
}

export function browse(songs: BrowserSong[], f: BrowseFilters): BrowserSong[] {
  const query = f.query.trim();
  const match = songMatcher(query);
  const q = fold(query);
  const chartFilterOn = Boolean(f.kind || f.difficulty || f.level);

  // [song, how well it matched the search (2 title, 1 sounds like, 0.5 loosely, 1.5 artist), top constant]
  const rows: Array<[BrowserSong, number, number]> = [];
  for (const song of songs) {
    if (f.region === 'na' && !song.na) continue;
    if (f.genre && song.genre !== f.genre) continue;
    if (f.version && song.version !== f.version) continue;

    const charts = matchingCharts(song, f);
    if (chartFilterOn && charts.length === 0) continue;

    let score = 2;
    if (query) {
      score = match(song.title, song.romaji);
      if (score <= 0 && song.artist && fold(song.artist).includes(q)) score = 1.5;
      if (score <= 0) continue;
    }
    rows.push([song, score, Math.max(...(chartFilterOn ? charts : song.charts).map((c) => c[2]))]);
  }

  const byName = (a: BrowserSong, b: BrowserSong) =>
    (a.romaji || a.title).toLowerCase().localeCompare((b.romaji || b.title).toLowerCase());

  rows.sort(([a, sa, la], [b, sb, lb]) => {
    if (sb !== sa) return sb - sa; // best matches first when searching
    if (f.sort === 'newest') return (b.versionCode ?? 0) - (a.versionCode ?? 0) || byName(a, b);
    if (f.sort === 'level') return lb - la || byName(a, b);
    return byName(a, b);
  });
  return rows.map(([song]) => song);
}

/** The choices for the genre and version drop-downs. */
export function facets(songs: BrowserSong[]) {
  const genres = new Set<string>();
  const versions = new Map<string, number>();
  for (const s of songs) {
    if (s.genre) genres.add(s.genre);
    if (s.version) versions.set(s.version, Math.max(versions.get(s.version) ?? 0, s.versionCode ?? 0));
  }
  return {
    genres: [...genres].sort((a, b) => a.localeCompare(b)),
    versions: [...versions].sort((a, b) => b[1] - a[1]).map(([name]) => name), // newest first
  };
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  basic: 'Basic', advanced: 'Advanced', expert: 'Expert', master: 'Master', remaster: 'Re:Master',
};
export const DIFFICULTY_COLORS: Record<string, string> = {
  basic: '#22a352', advanced: '#d99000', expert: '#e0403a', master: '#9b4fd1', remaster: '#a98bd6',
};

/** A constant as the site writes it: 13.7, and whole numbers below 7 (lib/level-summary.ts). */
export const constantLabel = (internal: number) => (internal >= 7 ? internal.toFixed(1) : String(Math.floor(internal)));
