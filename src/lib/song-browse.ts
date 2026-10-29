import { songMatcher } from './song-search';
import { toNormalWidth } from './leaderboard';
import { NEW_POOL_VERSIONS } from './versions';

/**
 * Searching and filtering the song list (/charts). Plain module, so it runs in the browser
 * (the list filters as you type) and can be tested on its own.
 */

export const DIFFICULTY_ORDER = ['basic', 'advanced', 'expert', 'master', 'remaster'] as const;

// one chart, packed small to keep the page light: [kind, difficultyIndex, internal]
//   kind: 1 is a DX chart, 0 a standard one
//   difficultyIndex: index into DIFFICULTY_ORDER (0 basic ... 4 remaster)
//   internal: the chart constant, 13.7
export type BrowserChart = [kind: 0 | 1, difficultyIndex: number, internal: number];

export type BrowserSong = {
  id: string;
  title: string;
  romaji: string | null;
  artist: string | null;
  genre: string | null;
  version: string | null;
  versionCode: number | null;
  jacket: string | null; // without the start every jacket address shares (see toBrowserList)
  na: boolean;
  plays: number; // players with a score on it, for "sort: popularity"
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
  pool: '' | 'new' | 'old'; // new: the versions that count toward B15, old: B35
  hearted: '' | '1'; // only the signed-in player's hearted songs
  played: '' | 'played' | 'unplayed'; // charts the signed-in player has (or hasn't) a score on
  raise: '' | '1'; // charts that would get into the signed-in player's B50 with an SSS+
  sort: 'title' | 'artist' | 'newest' | 'oldest' | 'level' | 'easiest' | 'popular';
};

export const DEFAULT_FILTERS: BrowseFilters = {
  query: '', genre: '', version: '', level: '', difficulty: '', kind: '', region: 'na', pool: '', hearted: '', played: '', raise: '', sort: 'title',
};

const fold = (text: string) => toNormalWidth(text ?? '').normalize('NFKC').toLowerCase();

/**
 * The signed-in player's charts (/api/profile/my-charts), for the played / unplayed and
 * "could raise my rating" filters. Per song id, a bit per chart (chartBit): one number per
 * song rather than a list of charts, to keep it small.
 */
export type MyCharts = { played: Record<string, number>; raise: Record<string, number> };
export const chartBit = (kind: number, difficultyIndex: number) => 1 << (kind * 5 + difficultyIndex);

/** Which of a song's charts pass the chart type / difficulty / level filters (and the player's own, given their charts). */
export function matchingCharts(song: BrowserSong, filters: BrowseFilters, mine?: MyCharts | null): BrowserChart[] {
  const wantedDifficultyIndex = filters.difficulty
    ? DIFFICULTY_ORDER.indexOf(filters.difficulty as (typeof DIFFICULTY_ORDER)[number])
    : -1; // -1: any difficulty
  return song.charts.filter(([kind, difficultyIndex, internal]) => {
    if (filters.kind === 'dx' && kind !== 1) return false;
    if (filters.kind === 'standard' && kind !== 0) return false;
    if (wantedDifficultyIndex >= 0 && difficultyIndex !== wantedDifficultyIndex) return false;
    if (filters.level && gameLevel(internal) !== filters.level) return false;
    if (mine) {
      const bit = chartBit(kind, difficultyIndex);
      if (filters.played) {
        const played = ((mine.played[song.id] ?? 0) & bit) !== 0;
        if (played !== (filters.played === 'played')) return false;
      }
      if (filters.raise && ((mine.raise[song.id] ?? 0) & bit) === 0) return false;
    }
    return true;
  });
}

/** Are the player's own filters on? Only once their charts are here: before that (or signed out) they're ignored. */
const ownFilterOn = (filters: BrowseFilters, mine?: MyCharts | null) => Boolean(mine && (filters.played || filters.raise));

/** Is the search narrowing by chart (type, difficulty, level, or the player's own)? Then songs with no matching chart are left out. */
export const hasChartFilter = (filters: BrowseFilters, mine?: MyCharts | null) =>
  Boolean(filters.kind || filters.difficulty || filters.level || ownFilterOn(filters, mine));

/** The songs that pass every filter and the search, in the order the list shows them. heartedIds: the signed-in player's hearted songs, for the hearted filter. */
export function filterAndSortSongs(
  songs: BrowserSong[], filters: BrowseFilters, heartedIds: ReadonlySet<string> = new Set(), mine?: MyCharts | null,
): BrowserSong[] {
  const searchText = filters.query.trim();
  const titleMatchScore = songMatcher(searchText); // (title, romaji) -> how well they match, 0 = not at all
  const foldedSearchText = fold(searchText);
  const chartFilterOn = hasChartFilter(filters, mine);

  type Match = {
    song: BrowserSong;
    searchScore: number; // how well it matched the search: 2 title, 1.5 artist, 1 sounds like, 0.5 loosely
    hardestConstant: number; // for "sort: hardest first" and "easiest first"
  };
  const matches: Match[] = [];

  for (const song of songs) {
    if (filters.region === 'na' && !song.na) continue;
    if (filters.genre && song.genre !== filters.genre) continue;
    if (filters.version && song.version !== filters.version) continue;
    if (filters.pool) {
      const isNew = song.version !== null && NEW_POOL_VERSIONS.includes(song.version);
      if (isNew !== (filters.pool === 'new')) continue;
    }
    if (filters.hearted && !heartedIds.has(song.id)) continue;

    const chartsFound = matchingCharts(song, filters, mine);
    if (chartFilterOn && chartsFound.length === 0) continue;

    let searchScore = 2; // no search: everything counts as a full match
    if (searchText) {
      searchScore = titleMatchScore(song.title, song.romaji);
      if (searchScore <= 0 && song.artist && fold(song.artist).includes(foldedSearchText)) searchScore = 1.5;
      if (searchScore <= 0) continue;
    }
    const chartsToRank = chartFilterOn ? chartsFound : song.charts;
    matches.push({ song, searchScore, hardestConstant: Math.max(...chartsToRank.map(([, , internal]) => internal)) });
  }

  const byName = (a: BrowserSong, b: BrowserSong) =>
    (a.romaji || a.title).toLowerCase().localeCompare((b.romaji || b.title).toLowerCase());

  matches.sort((a, b) => {
    if (b.searchScore !== a.searchScore) return b.searchScore - a.searchScore; // best matches first when searching
    if (filters.sort === 'artist') return (a.song.artist ?? '\uffff').toLowerCase().localeCompare((b.song.artist ?? '\uffff').toLowerCase()) || byName(a.song, b.song);
    if (filters.sort === 'newest') return (b.song.versionCode ?? 0) - (a.song.versionCode ?? 0) || byName(a.song, b.song);
    if (filters.sort === 'oldest') return (a.song.versionCode ?? Infinity) - (b.song.versionCode ?? Infinity) || byName(a.song, b.song); // no version: last
    if (filters.sort === 'level') return b.hardestConstant - a.hardestConstant || byName(a.song, b.song);
    // the reverse of hardest first: by each song's hardest (matching) chart, lowest first
    if (filters.sort === 'easiest') return a.hardestConstant - b.hardestConstant || byName(a.song, b.song);
    if (filters.sort === 'popular') return b.song.plays - a.song.plays || byName(a.song, b.song);
    return byName(a.song, b.song);
  });
  return matches.map((match) => match.song);
}

/** The choices for the genre and version drop-downs. */
export function filterChoices(songs: BrowserSong[]) {
  const genres = new Set<string>();
  const newestCodeByVersion = new Map<string, number>(); // version name -> its version code, for sorting
  for (const song of songs) {
    if (song.genre) genres.add(song.genre);
    if (song.version) newestCodeByVersion.set(song.version, Math.max(newestCodeByVersion.get(song.version) ?? 0, song.versionCode ?? 0));
  }
  return {
    genres: [...genres].sort((a, b) => a.localeCompare(b)),
    versions: [...newestCodeByVersion].sort((a, b) => b[1] - a[1]).map(([name]) => name), // newest first
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

/**
 * The pills on a song card: one row for the standard charts and one for DX, each easiest to
 * hardest. When a difficulty is picked (the "any difficulty" drop-down), the charts that
 * match the search are lit (" is-hit") and the rest dimmed (" is-dim"), so you can see which
 * chart matched. The difficulty filter and the player's own (played / unplayed, could raise)
 * do this: picking DX / ST or a level still narrows the list, but leaves every pill as it is.
 */
export function songCardChartRows(song: BrowserSong, filters: BrowseFilters, mine?: MyCharts | null) {
  const filtering = Boolean(filters.difficulty) || ownFilterOn(filters, mine);
  const chartsFound = new Set(filtering ? matchingCharts(song, filters, mine) : []);
  return ([0, 1] as const)
    .map((kind) => ({
      isDx: kind === 1,
      pills: song.charts
        .filter(([chartKind]) => chartKind === kind)
        .sort((a, b) => a[1] - b[1]) // by difficulty index: basic first
        .map((chart) => {
          const [, difficultyIndex, internal] = chart;
          const difficulty = DIFFICULTY_ORDER[difficultyIndex];
          return {
            key: `${kind}-${difficultyIndex}`,
            label: constantLabel(internal), // the text in the pill: "13.7"
            color: DIFFICULTY_COLORS[difficulty],
            tooltip: `${kind ? 'DX' : 'Standard'} ${DIFFICULTY_LABELS[difficulty]} ${constantLabel(internal)}`,
            highlightClass: !filtering ? '' : chartsFound.has(chart) ? ' is-hit' : ' is-dim',
          };
        }),
    }))
    .filter((row) => row.pills.length > 0);
}
