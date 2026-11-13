import { songKey } from './song-id';
import { VERSION_NAMES } from './versions';
import { CAP, ERAS, MAX_CONSTANT, MIN_PLAYERS, SIGMA_MAX, SIGMA_SHOW_MAX, S_MIN, centerRating, type ChartFeel } from './plays-like';

/**
 * "Plays like" from maishift's data (lib/plays-like.ts has the version from this site's own
 * players). maishift gives, for every chart, how many players in each rating band got each
 * rank (scripts/fetch-maishift-song.mjs saves it; it's imported into maishift_levels).
 * Plain module, so it can be tested on its own. The doc "How plays like is worked out" and the
 * song page's popup explain the same steps with the same names.
 *
 * For each rating band b within 750 of the chart's center rating R (an SSS+ on it x 50):
 *   1. middle score m: the middle player's accuracy, from the rank counts
 *   2. pool P: same-era charts within W (0.5) of the constant c, this chart left out. A band
 *      needs MIN_CHARTS of them; if the era has fewer, the versions just outside it are added,
 *      one each side at a time, until it does
 *   3. typical curve, by least squares over P:  m_j = a - S x d_j + q x d_j^2 + beta x x_j
 *        d_j = c_j - c, x_j = log2(players_j) - their average
 *      a: typical middle score at c, S: % lost per +1.0 constant at c, q: how much the curve
 *      bends (it flattens toward 101%), beta: % gained per doubling of players, s: how far
 *      charts sit from the curve
 *   4. this chart's gap g = (m - beta x (log2 players - average)) - a, in %
 *   5. in constant: dc = g / S, uncertainty sigma = s / S, weight w = 1 / sigma^2
 * Then dc = sum(w x dc) / sum(w), sigma = 1 / sqrt(sum(w)), and plays like = c - dc, moved at
 * most CAP, never above MAX_CONSTANT. + is easier. Sure when sigma is SIGMA_MAX or less, shown
 * marked uncertain up to SIGMA_SHOW_MAX, hidden above.
 *
 * maishift's terms: credit maishift and say the site is unofficial and not affiliated with
 * SEGA wherever its data shows (components/SongPageView.tsx does).
 */

/** One chart's numbers in one band: players with a counted score, and how many got each rank. */
export type MaishiftEntry = { id: number; n: number; c: number[] }; // c: <94, AAA, S, S+, SS, SS+, SSS, SSS+, AP+
export type MaishiftLevelDoc = { _id: number; constant: number; region: string; fetchedAt: string; bands: Record<string, MaishiftEntry[]> };
export type MaishiftChartInfo = { title: string; type: string; difficulty: string; version: string | null };
export type MaishiftChartsDoc = { _id: 'charts'; fetchedAt: string; charts: Record<string, MaishiftChartInfo | null> };

/** The ranks, in the order of an entry's counts, with the accuracy range each covers. */
export const RANKS = ['<94', 'AAA', 'S', 'S+', 'SS', 'SS+', 'SSS', 'SSS+', 'AP+'] as const;
const RANGES: Array<[number, number]> = [[90, 94], [94, 97], [97, 98], [98, 99], [99, 99.5], [99.5, 100], [100, 100.5], [100.5, 101], [101, 101]];

/** W: how far either side of the constant the comparison charts reach, in tenths (0.5). */
export const REACH_TENTHS = 5;
/** The fewest comparison charts a band needs (nearby versions are added until there are this many). */
export const MIN_CHARTS = 15;
/** s_min: the smallest scatter allowed (%), so one band can't take all the weight. */
export const SCATTER_MIN = 0.05;

/** One band's numbers, for the bars and the popup. Names as in the doc. */
export type MaishiftBand = {
  from: number; to: number; // b: 14,750 to 14,999
  players: number; // n_b
  middle: number; // m_b (%)
  adjusted: number; // m~_b: popularity taken out (%)
  typicalScore: number; // a_b (%)
  perConstant: number; // S_b (% per 1.0 constant, at c)
  curve: number; // q_b: how much the typical curve bends (% per level squared)
  perDoubling: number; // beta_b (% per doubling of players)
  scatter: number; // s_b (%)
  gap: number; // g_b (%)
  dc: number; // delta c_b (constant)
  weight: number; // w_b as a share of all the bands' weight (0 to 1)
  comparisonCharts: number; // |P_b|
  widened: string | null; // the versions P_b used when the era alone had too few charts ("UNiVERSE–CiRCLE PLUS"), else null
};

/** Everything maishift's data says about one chart, for the page. */
export type MaishiftDetail = { bands: MaishiftBand[]; dc: number; sigma: number; era: string; fetchedAt: string };

/** maishift's data, as loaded from maishift_levels, with an index from the site's charts to maishift's. */
export type MaishiftData = { levels: Map<number, MaishiftLevelDoc>; charts: Record<string, MaishiftChartInfo | null>; byChart: Map<string, number>; fetchedAt: string };

/** The key both sides share: folded title | standard / dx | basic ... remaster. */
export const maishiftKey = (title: string, kind: string, difficulty: string) =>
  `${songKey(title)}|${/dx/i.test(kind) ? 'dx' : 'standard'}|${difficulty.toLowerCase().replace(/[^a-z]/g, '')}`;

export function maishiftData(docs: Array<MaishiftLevelDoc | MaishiftChartsDoc>): MaishiftData | null {
  const chartsDoc = docs.find((d): d is MaishiftChartsDoc => d._id === 'charts');
  const levels = new Map(docs.filter((d): d is MaishiftLevelDoc => typeof d._id === 'number').map((d) => [d._id, d]));
  if (!chartsDoc || levels.size === 0) return null;
  const byChart = new Map<string, number>();
  for (const [id, info] of Object.entries(chartsDoc.charts)) {
    if (info) byChart.set(maishiftKey(info.title, info.type, info.difficulty), Number(id));
  }
  return { levels, charts: chartsDoc.charts, byChart, fetchedAt: chartsDoc.fetchedAt };
}

// a version's name -> its code (lib/versions.ts), for the era. "FESTiVAL PLUS" -> 23500
const CODE_BY_NAME = new Map(Object.entries(VERSION_NAMES).map(([code, name]) => [name.toLowerCase(), Number(code)]));
// maishift writes these versions' names in Japanese
for (const [name, code] of [['でらっくす', 20000], ['でらっくす plus', 20500], ['スプラッシュ', 21000], ['スプラッシュ plus', 21500]] as const) CODE_BY_NAME.set(name, code);
const eraOfCode = (code: number | null) => ERAS.findIndex((e) => (code ?? 0) >= e.from);
// every version in order, oldest first, for widening an era by the versions next to it
const VERSION_CODES = Object.keys(VERSION_NAMES).map(Number).sort((a, b) => a - b);
const versionIndexOfCode = (code: number | null) => {
  let index = -1;
  for (let i = 0; i < VERSION_CODES.length; i++) if (VERSION_CODES[i] <= (code ?? -1)) index = i;
  return index;
};
const versionIndexOfName = (name: string | null | undefined) => versionIndexOfCode(name ? CODE_BY_NAME.get(name.toLowerCase()) ?? null : null);
/** An era's versions, as [first, last] positions in VERSION_CODES. */
function eraVersionRange(era: number): [number, number] {
  const from = ERAS[era]?.from ?? 0;
  const to = era > 0 ? ERAS[era - 1].from : Infinity; // ERAS runs newest first
  const inside = VERSION_CODES.map((c, i) => [c, i]).filter(([c]) => c >= from && c < to).map(([, i]) => i);
  return [Math.min(...inside), Math.max(...inside)];
}

// maishift's rating bands: 13000-13500, 13500-14000, then 250 wide up to 17000
const BANDS: Array<[number, number]> = [[13000, 13500], [13500, 14000]];
for (let from = 14000; from < 17000; from += 250) BANDS.push([from, from + 250]);

/** B: the bands a chart is compared in, within 3 rating groups (750) of its center rating R. */
export function bandsFor(constant: number): Array<[number, number]> {
  const group = Math.floor(centerRating(constant) / 250);
  const from = (group - 3) * 250;
  const to = (group + 3) * 250 + 249;
  return BANDS.filter(([a, b]) => a <= to && b - 1 >= from);
}

/** Counts with any players the score ranks missed (an AP below AP+ only shows as a combo) counted as SSS+. */
const fullCounts = (e: MaishiftEntry) => {
  const c = [...e.c];
  c[7] += Math.max(0, e.n - c.reduce((t, v) => t + v, 0));
  return c;
};

/** m: the middle player's accuracy, from rank counts. */
export function middleScore(counts: number[]): number {
  const total = counts.reduce((t, v) => t + v, 0);
  let seen = 0;
  for (let i = 0; i < counts.length; i++) {
    if (seen + counts[i] >= total / 2) {
      const [low, high] = RANGES[i];
      return counts[i] ? low + ((total / 2 - seen) / counts[i]) * (high - low) : low;
    }
    seen += counts[i];
  }
  return 101;
}

const mean = (v: number[]) => v.reduce((t, x) => t + x, 0) / v.length;
const log2 = (n: number) => Math.log2(Math.max(1, n));
const round = (n: number, p: number) => Math.round(n * 10 ** p) / 10 ** p;

/** Least squares: the coefficients b that make sum((y - b . v)^2) smallest. null if they can't be found. */
function leastSquares(rows: Array<{ v: number[]; y: number }>): number[] | null {
  const k = rows[0]?.v.length ?? 0;
  const m = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (const { v, y } of rows) {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) m[i][j] += v[i] * v[j];
      m[i][k] += v[i] * y;
    }
  }
  for (let col = 0; col < k; col++) { // Gaussian elimination with pivoting
    let pivot = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-9) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c2 = col; c2 <= k; c2++) m[r][c2] -= f * m[col][c2];
    }
  }
  return m.map((row, i) => row[k] / row[i]);
}

/** "Plays like" for one chart from maishift's data, or null when it has none for that chart. */
export function maishiftFeel(constant: number, versionCode: number | null, maishiftId: number, data: MaishiftData): ChartFeel | null {
  const tenth = Math.round(constant * 10);
  const maxTenth = Math.round(MAX_CONSTANT * 10);
  // the pool reaches W either side, so every constant in it has to have been fetched (nothing is above MAX_CONSTANT)
  const reach: number[] = [];
  for (let t = tenth - REACH_TENTHS; t <= Math.min(maxTenth, tenth + REACH_TENTHS); t++) reach.push(t);
  if (!reach.every((t) => data.levels.has(t))) return null;
  const era = eraOfCode(versionCode);
  const bands: Array<MaishiftBand & { w: number }> = [];

  for (const [from, to] of bandsFor(constant)) {
    const key = `${from}-${to}`;
    const target = data.levels.get(tenth)?.bands[key]?.find((e) => e.id === maishiftId);
    if (!target) continue; // under 5 players here, or not fetched

    // P_b: same-era charts within W; with fewer than MIN_CHARTS, the versions just outside the
    // era are added, one each side at a time
    const near = reach.flatMap((t) => (data.levels.get(t)?.bands[key] ?? [])
      .filter((e) => e.id !== maishiftId)
      .map((e) => ({ e, d: (t - tenth) / 10, m: middleScore(fullCounts(e)), v: versionIndexOfName(data.charts[e.id]?.version) })));
    let [lo, hi] = eraVersionRange(era < 0 ? ERAS.length - 1 : era);
    const [eraLo, eraHi] = [lo, hi];
    let pool = near.filter(({ v }) => v >= lo && v <= hi);
    while (pool.length < MIN_CHARTS && (lo > 0 || hi < VERSION_CODES.length - 1)) {
      lo = Math.max(0, lo - 1);
      hi = Math.min(VERSION_CODES.length - 1, hi + 1);
      pool = near.filter(({ v }) => v >= lo && v <= hi);
    }
    if (pool.length < MIN_CHARTS) continue;
    const widened = lo !== eraLo || hi !== eraHi ? `${VERSION_NAMES[String(VERSION_CODES[lo])]}–${VERSION_NAMES[String(VERSION_CODES[hi])]}` : null;

    // the typical curve: m_j = a - S d_j + q d_j^2 + beta x_j (a straight line would sit under
    // a curve that flattens toward 101% and make every chart look a little easy)
    const averageLog = mean(pool.map(({ e }) => log2(e.n)));
    const fit = leastSquares(pool.map(({ e, d, m }) => ({ v: [1, d, d * d, log2(e.n) - averageLog], y: m })));
    if (!fit) continue;
    const S = Math.max(S_MIN, -fit[1]);
    const curve = fit[2];
    const beta = Math.max(0, fit[3]);
    // a, given S, q and beta (the same as the fit's own unless a floor was used)
    const typicalAt = (d: number, n: number) => -S * d + curve * d * d + beta * (log2(n) - averageLog);
    const a = mean(pool.map(({ e, d, m }) => m - typicalAt(d, e.n)));
    const misses = pool.map(({ e, d, m }) => m - (a + typicalAt(d, e.n)));
    const s = Math.max(SCATTER_MIN, Math.sqrt(misses.reduce((t, r) => t + r * r, 0) / Math.max(1, pool.length - 4)));

    const middle = middleScore(fullCounts(target));
    const adjusted = middle - beta * (log2(target.n) - averageLog);
    const gap = adjusted - a;
    const dc = gap / S;
    const sigma = s / S;


    bands.push({
      from, to: to - 1, players: target.n,
      middle: round(middle, 3), adjusted: round(adjusted, 3), typicalScore: round(a, 3),
      perConstant: round(S, 3), curve: round(curve, 3), perDoubling: round(beta, 3), scatter: round(s, 3),
      gap: round(gap, 3), dc: round(dc, 3), weight: 0,
      comparisonCharts: pool.length, widened,
      w: 1 / (sigma * sigma),
    });
  }
  if (!bands.length) return null;

  const totalWeight = bands.reduce((t, b) => t + b.w, 0);
  const dc = bands.reduce((t, b) => t + b.w * (b.gap / b.perConstant), 0) / totalWeight;
  const sigma = 1 / Math.sqrt(totalWeight);
  const move = Math.max(-CAP, Math.min(CAP, dc));
  const unsure = sigma > SIGMA_MAX;
  const hidden = sigma > SIGMA_SHOW_MAX;
  const players = bands.reduce((t, b) => t + b.players, 0);
  return {
    source: 'maishift',
    needed: MIN_PLAYERS,
    counted: players,
    allRatings: false,
    ratingFrom: bands[0].from,
    ratingTo: bands[bands.length - 1].to,
    baselineFrom: (tenth - REACH_TENTHS) / 10,
    baselineTo: Math.min(maxTenth, tenth + REACH_TENTHS) / 10,
    playsLike: hidden ? null : Math.min(MAX_CONSTANT, Math.round((constant - move) * 10) / 10),
    sigma: round(sigma, 3),
    unsure,
    lowSample: players < MIN_PLAYERS,
    groups: [],
    maishift: {
      bands: bands.map(({ w, ...b }) => ({ ...b, weight: round(w / totalWeight, 3) })),
      dc: round(dc, 3),
      sigma: round(sigma, 3),
      era: ERAS[era]?.label ?? 'all versions',
      fetchedAt: data.fetchedAt,
    },
  };
}
