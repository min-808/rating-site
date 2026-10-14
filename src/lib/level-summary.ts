import { toNormalWidth, type Song } from './leaderboard';
import { CHART_DIFFICULTIES } from './difficulties';
import { VERSION_NAMES } from './versions';
import { rankFor, rateSong } from './song-calc';

/**
 * The level summary (/user/[id]/levels): every chart in a range of internal levels, with
 * how the player has done on it.
 *
 * Every chart in the game comes from the songs collection: each song document holds its
 * standard charts (lev_mas_i...) and its DX charts (dx_lev_mas_i...), basic through
 * re:master. Only songs in the international version count (intl "1"). The player's
 * scores are matched onto them by title, kind and difficulty; a score for a chart the
 * collection doesn't list (her japanese scores, say) is added as it is.
 */

export type SongDoc = {
  title: string;
  version?: string | number;
  intl?: string | number;
  [field: string]: unknown;
};

export type SummaryChart = {
  key: string;
  title: string;
  kind: 'dx' | 'standard';
  difficulty: string;
  level: string | null; // shown level, "13+"
  internal: number; // the constant, 13.7
  versionCode: number | null;
  genre: string | null; // for the two songs that share a title (the "Link"s), whose jackets are kept by genre
  played: Song | null; // their score, with rating filled in
};

export type SummaryFilters = {
  min: number;
  max: number;
  includeUnplayed: boolean;
  versionFrom: number | null; // a version's base code (26000), null: no lower limit
  versionTo: number | null; // a version's base code, null: no upper limit
  difficulties?: string[] | null; // only these ("expert", "master"...), null: every difficulty
  grades?: string[] | null; // only played charts with these grades ("SSS+", "below A"...), null or empty: any
  excludedTitles?: Set<string> | null; // NA: songs not available there (naExcluded), left out entirely
};

const SUFFIX: Record<string, string> = { basic: 'bas', advanced: 'adv', expert: 'exp', master: 'mas', remaster: 'remas' };

const titleKey = (title: string) => toNormalWidth(String(title ?? '')).replace(/\s+/g, ' ').trim().toLowerCase();
const chartKey = (title: string, kind: string, difficulty: string) => `${titleKey(title)}|${kind}|${difficulty}`;

// version base codes in order (10000, 11000 ... 26500), for "from / to" ranges
export const VERSION_BASES = Object.keys(VERSION_NAMES).map(Number).sort((a, b) => a - b);

// the base code a song's version belongs to: 26512 -> 26500 (CiRCLE PLUS)
export function versionBase(code: number | null): number | null {
  if (code == null || !Number.isFinite(code)) return null;
  let base: number | null = null;
  for (const b of VERSION_BASES) {
    if (b <= code) base = b;
    else break;
  }
  return base;
}

/**
 * The songs North America doesn't have (marked na "0"), by title, for the NA view (the same
 * rule as the profile's level breakdown). A title only counts as missing if every song
 * with it is marked, since a few titles are shared.
 */
export function naExcluded(songDocs: Array<{ title: string; na?: string | number | null }>): Set<string> {
  const available = new Map<string, boolean>();
  for (const s of songDocs) {
    const key = titleKey(s.title);
    available.set(key, (available.get(key) ?? false) || String(s.na) !== '0');
  }
  return new Set([...available].filter(([, ok]) => !ok).map(([key]) => key));
}

/** Every chart: the collection's, with the player's scores on them, plus scores it doesn't list. */
export function allCharts(songDocs: SongDoc[], scores: Song[]): SummaryChart[] {
  const byKey = new Map<string, SummaryChart>();

  for (const doc of songDocs) {
    if (String(doc.intl ?? '1') === '0') continue; // japan only: not playable here
    const versionCode = Number(doc.version);
    for (const kind of ['standard', 'dx'] as const) {
      for (const difficulty of CHART_DIFFICULTIES) {
        const field = `${kind === 'dx' ? 'dx_' : ''}lev_${SUFFIX[difficulty]}`;
        const internal = parseFloat(String(doc[`${field}_i`] ?? ''));
        if (!Number.isFinite(internal)) continue;
        const key = chartKey(doc.title, kind, difficulty);
        byKey.set(key, {
          key,
          title: doc.title,
          kind,
          difficulty,
          level: doc[field] != null ? String(doc[field]) : null,
          internal,
          versionCode: Number.isFinite(versionCode) ? versionCode : null,
          genre: doc.catcode != null ? String(doc.catcode) : null,
          played: null,
        });
      }
    }
  }

  for (const s of scores) {
    if (!((s.achievement ?? 0) > 0)) continue;
    const kind = s.kind === 'dx' ? 'dx' : 'standard';
    const key = chartKey(s.title, kind, s.difficulty);
    const played = { ...s, rating: rateSong(s) };
    const chart = byKey.get(key);
    if (chart) {
      chart.played = played;
      if (s.genre) chart.genre = s.genre; // the score's genre spelling, which the jackets are kept under
      // the score's own constant, when it has one (a japanese score has japan's)
      if (Number.isFinite(s.internal_difficulty)) chart.internal = s.internal_difficulty;
    } else if (Number.isFinite(s.internal_difficulty)) {
      byKey.set(key, {
        key,
        title: s.title,
        kind,
        difficulty: s.difficulty,
        level: s.level ?? null,
        internal: s.internal_difficulty,
        versionCode: s.version_code ?? null,
        genre: s.genre ?? null,
        played,
      });
    }
  }

  return [...byKey.values()];
}

// internal levels only go by tenths from 7.0 up: below that, levels are whole numbers
// (some old charts still carry constants like 6.5, but the game calls them 6)
export const FIRST_DECIMAL_LEVEL = 7;

/** A chart's level for sorting and filtering: its constant from 7.0 up, its whole level below. */
export function levelValue(c: Pick<SummaryChart, 'internal' | 'level'>): number {
  if (c.internal >= FIRST_DECIMAL_LEVEL) return c.internal;
  const shown = parseInt(String(c.level ?? ''), 10);
  return Number.isFinite(shown) && shown < FIRST_DECIMAL_LEVEL ? shown : Math.floor(c.internal);
}

/** How a level is written: "14.4" from 7.0 up, "6" below. */
export const levelLabel = (value: number) => (value >= FIRST_DECIMAL_LEVEL ? value.toFixed(1) : String(Math.floor(value)));

export function filterCharts(charts: SummaryChart[], f: SummaryFilters): SummaryChart[] {
  // a hair of slack, so 14.0 as the top of the range includes 14.0 itself
  return charts.filter((c) => {
    const level = levelValue(c);
    if (level < f.min - 1e-9 || level > f.max + 1e-9) return false;
    if (!f.includeUnplayed && !c.played) return false;
    if (f.difficulties && !f.difficulties.includes(c.difficulty)) return false;
    if (f.excludedTitles?.has(titleKey(c.title))) return false;
    // unplayed charts have no grade: "include unplayed" decides those
    if (f.grades?.length && c.played && !f.grades.includes(gradeOf(c))) return false;
    if (f.versionFrom != null || f.versionTo != null) {
      const base = versionBase(c.versionCode);
      if (base == null) return false;
      if (f.versionFrom != null && base < f.versionFrom) return false;
      if (f.versionTo != null && base > f.versionTo) return false;
    }
    return true;
  });
}

/*
 * The summary's counts, the way maimai NET's own level pages count them: each one is that
 * grade (or badge) OR BETTER, out of every chart in the range. "S 494/528" is 494 charts at
 * S or higher, the same 494 that are also counted under CLEAR.
 */
export const CLEAR_AT = 80; // an A or better is a clear
export const SUMMARY_RANKS = [ // worst to best, as the game lays them out
  { label: 'S', min: 97 }, { label: 'S+', min: 98 }, { label: 'SS', min: 99 },
  { label: 'SS+', min: 99.5 }, { label: 'SSS', min: 100 }, { label: 'SSS+', min: 100.5 },
] as const;
const COMBO_TIER: Record<string, number> = { fc: 1, fcplus: 2, ap: 3, app: 4, applus: 4 };
export const SUMMARY_COMBOS = [
  { label: 'FC', tier: 1 }, { label: 'FC+', tier: 2 }, { label: 'AP', tier: 3 }, { label: 'AP+', tier: 4 },
] as const;
const SYNC_TIER: Record<string, number> = { sync: 1, fs: 2, fsplus: 3, fdx: 4, fdxplus: 5 };
// no plain SYNC PLAY: the friend comparison pages the scores come from don't show it, so it
// could only ever undercount (maimai NET's 401 against our 40)
export const SUMMARY_SYNCS = [
  { label: 'FS', tier: 2 }, { label: 'FS+', tier: 3 }, { label: 'FDX', tier: 4 }, { label: 'FDX+', tier: 5 },
] as const;

export function summarize(charts: SummaryChart[]) {
  const played = charts.filter((c) => c.played).map((c) => c.played!);
  const atLeast = (pred: (s: Song) => boolean) => played.filter(pred).length;
  const comboTier = (s: Song) => COMBO_TIER[(s.fc || (s.ap ? 'ap' : '')).toLowerCase().replace(/[^a-z]/g, '')] ?? 0;
  const syncTier = (s: Song) => SYNC_TIER[(s.fs || '').toLowerCase().replace(/[^a-z]/g, '')] ?? 0;
  return {
    total: charts.length,
    played: played.length,
    average: played.length ? played.reduce((t, s) => t + (s.achievement ?? 0), 0) / played.length : null,
    clear: atLeast((s) => (s.achievement ?? 0) >= CLEAR_AT),
    ranks: Object.fromEntries(SUMMARY_RANKS.map((r) => [r.label, atLeast((s) => (s.achievement ?? 0) >= r.min)])),
    combos: Object.fromEntries(SUMMARY_COMBOS.map((c) => [c.label, atLeast((s) => comboTier(s) >= c.tier)])),
    syncs: Object.fromEntries(SUMMARY_SYNCS.map((x) => [x.label, atLeast((s) => syncTier(s) >= x.tier)])),
  };
}

/** Charts grouped by constant (by whole level below 7), highest first; in each, played best-first, then unplayed by title. */
export function groupByConstant(charts: SummaryChart[]) {
  const groups = new Map<string, SummaryChart[]>();
  for (const c of charts) {
    const label = levelLabel(levelValue(c));
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(c);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([constant, list]) => ({
      constant,
      charts: list.sort((a, b) =>
        (Number(Boolean(b.played)) - Number(Boolean(a.played)))
        || ((b.played?.achievement ?? 0) - (a.played?.achievement ?? 0))
        || a.title.localeCompare(b.title)),
    }));
}

// the grades a played chart can have, best first (the grade filter's choices)
export const GRADES = ['SSS+', 'SSS', 'SS+', 'SS', 'S+', 'S', 'AAA', 'AA', 'A', 'below A'] as const;

/**
 * The grade filter's choice ("below-SSS+", "SS-up") as the grades it lets through:
 * "below SSS+" is everything under SSS+ (SSS down to below A), "SS or better" is SS up to
 * SSS+. Anything else: null (no filter)
 */
export function gradesFor(choice: string | null | undefined): string[] | null {
  const m = String(choice ?? '').match(/^(?:below-(.+)|(.+)-up)$/);
  if (!m) return null;
  const i = (GRADES as readonly string[]).indexOf(m[1] ?? m[2]);
  if (i < 0) return null;
  return m[1] ? GRADES.slice(i + 1) : GRADES.slice(0, i + 1);
}

/** A played chart's grade ("SSS+" ... "A", or "below A"). */
export function gradeOf(c: SummaryChart): string {
  const rank = c.played ? rankFor(c.played.achievement)?.rank : null;
  return rank && (GRADES as readonly string[]).includes(rank) ? rank : 'below A';
}

// how a level's charts can be split into rows, and each way's rows, best first. charts
// that don't fit a named row go in the "below" / "no" row, unplayed charts last
export const ROW_ORDERS = {
  grade: ['SSS+', 'SSS', 'SS+', 'SS', 'S+', 'S', 'AAA', 'AA', 'A', 'below A', 'unplayed'],
  combo: ['AP+', 'AP', 'FC+', 'FC', 'no combo', 'unplayed'],
  sync: ['FDX+', 'FDX', 'FS+', 'FS', 'SYNC', 'no sync', 'unplayed'],
  ap: ['AP+', 'AP', 'no AP', 'unplayed'],
} as const;
export type RowSort = keyof typeof ROW_ORDERS;

const COMBO_ROW: Record<string, string> = { applus: 'AP+', app: 'AP+', ap: 'AP', fcplus: 'FC+', fc: 'FC' };
const SYNC_ROW: Record<string, string> = { fdxplus: 'FDX+', fdx: 'FDX', fsplus: 'FS+', fs: 'FS', sync: 'SYNC' };

// which row a chart goes in, for a way of splitting
function rowOf(chart: SummaryChart, by: RowSort): string {
  const s = chart.played;
  if (!s) return 'unplayed';
  if (by === 'combo') return COMBO_ROW[(s.fc || (s.ap ? 'ap' : '')).toLowerCase().replace(/[^a-z]/g, '')] ?? 'no combo';
  if (by === 'ap') {
    const combo = COMBO_ROW[(s.fc || (s.ap ? 'ap' : '')).toLowerCase().replace(/[^a-z]/g, '')];
    return combo === 'AP+' || combo === 'AP' ? combo : 'no AP';
  }
  if (by === 'sync') return SYNC_ROW[(s.fs || '').toLowerCase().replace(/[^a-z]/g, '')] ?? 'no sync';
  const rank = rankFor(s.achievement)?.rank;
  return rank && (ROW_ORDERS.grade as readonly string[]).includes(rank) ? rank : 'below A';
}

/** A level's charts split into rows (by grade, combo, sync or AP), best first; in each, best score first. */
export function groupRows(charts: SummaryChart[], by: RowSort) {
  const rows = new Map<string, SummaryChart[]>();
  for (const c of charts) {
    const row = rowOf(c, by);
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push(c);
  }
  return (ROW_ORDERS[by] as readonly string[]).filter((row) => rows.has(row)).map((row) => ({
    row,
    charts: rows.get(row)!.sort((a, b) =>
      (b.internal - a.internal)
      || ((b.played?.achievement ?? 0) - (a.played?.achievement ?? 0))
      || a.title.localeCompare(b.title)),
  }));
}
