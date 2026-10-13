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
  played: Song | null; // their score, with rating filled in
};

export type SummaryFilters = {
  min: number;
  max: number;
  includeUnplayed: boolean;
  versionFrom: number | null; // a version's base code (26000), null: no lower limit
  versionTo: number | null; // a version's base code, null: no upper limit
  difficulties?: string[] | null; // only these ("expert", "master"...), null: every difficulty
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
    if (f.versionFrom != null || f.versionTo != null) {
      const base = versionBase(c.versionCode);
      if (base == null) return false;
      if (f.versionFrom != null && base < f.versionFrom) return false;
      if (f.versionTo != null && base > f.versionTo) return false;
    }
    return true;
  });
}

// the ranks the summary counts, best first. anything under S is "below S"
export const SUMMARY_RANKS = ['SSS+', 'SSS', 'SS+', 'SS', 'S+', 'S'] as const;

export function summarize(charts: SummaryChart[]) {
  const played = charts.filter((c) => c.played).map((c) => c.played!);
  const ranks: Record<string, number> = Object.fromEntries([...SUMMARY_RANKS, 'below S'].map((r) => [r, 0]));
  let fc = 0;
  let ap = 0;
  let fdx = 0;
  let clears = 0;
  for (const s of played) {
    const rank = rankFor(s.achievement)?.rank;
    if (rank && (SUMMARY_RANKS as readonly string[]).includes(rank)) ranks[rank]++;
    else ranks['below S']++;
    if ((s.achievement ?? 0) >= 80) clears++;
    const combo = (s.fc || (s.ap ? 'ap' : '')).toLowerCase();
    if (combo) fc++;
    if (combo.startsWith('ap')) ap++;
    if ((s.fs ?? '').toLowerCase().startsWith('fdx')) fdx++;
  }
  const average = played.length ? played.reduce((t, s) => t + (s.achievement ?? 0), 0) / played.length : null;
  return { total: charts.length, played: played.length, average, ranks, clears, fc, ap, fdx };
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
