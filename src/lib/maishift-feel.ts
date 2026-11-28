import { songKey } from './song-id';
import { VERSION_NAMES } from './versions';
import { CAP, ERAS, MAX_CONSTANT, MIN_PLAYERS, centerRating, type ChartFeel } from './plays-like';

/**
 * "Plays like" by the rating bucket method, from maishift's data (lib/plays-like.ts has the
 * fallback from this site's own players). maishift gives, for every chart, how many players in
 * each rating bucket (band) got each rank (scripts/fetch-maishift-song.mjs saves it; it's imported
 * into maishift_levels). Plain module, so it can be tested on its own. The doc "How plays like is
 * worked out", the "how plays like works" page (app/plays-like) and the song page's popup explain
 * the same steps with the same names.
 *
 *   1. buckets B: every maishift bucket from BUCKETS_BELOW groups under the chart's center rating R
 *      (an SSS+ on it x 50) to BUCKETS_ABOVE over it. None is picked by hand: step 8 weighs them
 *   2. middle score m_b: the middle player's accuracy, from the rank counts, and its sampling
 *      error e_b (how far it could move with other players)
 *   3. pool P_b: same-era charts within W (0.5) of the constant c, this chart left out; with
 *      fewer than MIN_CHARTS, the versions just outside the era are added, one each side at a time
 *   4. log gap: l_b = ln(101 - m_b + LOG_OFFSET), how far the score is from 101% on a log scale,
 *      so a step near the top counts for more than the same step lower down (the idea is from
 *      critlog's perceived-constant method). Its error: e_l = e_b / (101 - m_b + LOG_OFFSET).
 *      Smaller is better. (Until 2026-11-27 this step evened out popularity by player count; with
 *      best scores only, more players and higher scores can't be told apart as cause and effect,
 *      and taking it out made results agree more, so it's gone)
 *   5. typical line, by least squares over P_b:  -l_j = a - S x d_j + q x d_j^2  (d_j = c_j - c),
 *      with the errors of a and S from the fit (se_a, se_S). A bucket whose S is MIN_RATE or less
 *      can't tell charts apart and is skipped
 *   6. gap g_b = -l_b - a_b (in log gap; + is a better score than typical)
 *   7. in constant: dc_b = g_b / S_b; errors: sample_b = sqrt(e_b^2 + se_a^2) / S_b,
 *      rate_b = |dc_b| x se_S / S_b; weight w_b = 1 / (sample_b^2 + rate_b^2)
 *   8. combined: dc = sum(w dc) / sum(w); sigma = sqrt(sample^2 + rate^2 + disagree^2) with
 *      sample = 1 / sqrt(sum(1 / sample_b^2)), rate = sum(w rate_b) / sum(w),
 *      disagree = sqrt(sum(w (dc_b - dc)^2) / sum(w) / (buckets - 1))
 *   9. fit to the level (SPREAD_TARGET): at each constant, how spread out charts' results are
 *      (1.4826 x the median distance from the median, over every maishift chart at that constant
 *      that isn't hidden); scale = min(1, SPREAD_TARGET / spread); dc and sigma are multiplied by it.
 *      Based on the site owner's understanding of the game: within one constant, charts feel at
 *      most about 0.3 to 0.5 apart, so a wider spread is taken as the method's scale being off
 *  10. how sure: 95% range = dc +- 2 sigma. Sure when 2 sigma <= SURE_RANGE; shown marked uncertain
 *      when it's wider but |dc| > 2 sigma (it clearly leans one way); hidden otherwise.
 * plays like = c - dc, moved at most CAP, rounded to 0.1, never above MAX_CONSTANT. + is easier.
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
export const RANGES: Array<[number, number]> = [[90, 94], [94, 97], [97, 98], [98, 99], [99, 99.5], [99.5, 100], [100, 100.5], [100.5, 101], [101, 101]];

/** W: how far either side of the constant the comparison charts reach, in tenths (0.5). */
export const REACH_TENTHS = 5;
/** The fewest comparison charts a bucket needs (nearby versions are added until there are this many). */
export const MIN_CHARTS = 15;
/** Buckets used: from this many 250-wide groups under the center rating's group... */
export const BUCKETS_BELOW = 6;
/** ...to this many over it. */
export const BUCKETS_ABOVE = 4;
/** Step 4: l = ln(101 - m + LOG_OFFSET); keeps an AP+ middle score (101) finite. */
export const LOG_OFFSET = 0.02;
/** A bucket whose log gap per +1.0 constant is this or less can't tell charts apart: skipped. */
export const MIN_RATE = 0.02;
/** s_min: the smallest scatter allowed (log gap). */
export const SCATTER_MIN = 0.01;
/** Sure when the 95% range reaches no further than this either side. */
export const SURE_RANGE = 0.2;
/** Step 9: how spread out results at one constant may be (1 standard deviation); about 95% of charts then move under 0.5. */
export const SPREAD_TARGET = 0.25;
/** Charts it takes to measure a constant's spread; with fewer, the constants next to it are added. */
export const SPREAD_MIN_CHARTS = 8;
/** One bucket can't be checked against another: its disagreement counts as this. */
export const SINGLE_BUCKET_DISAGREE = 0.3;

/** One bucket's numbers, for the bars and the popup. Names as in the doc. */
export type MaishiftBand = {
  from: number; to: number; // b: 14,750 to 14,999
  position: number; // k: groups from the center rating's group (-1: one under)
  players: number; // n_b
  middle: number; // m_b (%)
  middleError: number; // e_b (%)
  logGap: number; // l_b = ln(101 - m_b + LOG_OFFSET)
  logGapError: number; // e_l
  typicalLogGap: number; // -a_b: a typical chart's log gap here
  typicalScore: number; // the same as a score (%), for the bars: 101 + LOG_OFFSET - e^(-a_b)
  typicalError: number; // se_a (log gap)
  perConstant: number; // S_b (log gap per 1.0 constant, at c)
  perConstantError: number; // se_S
  curve: number; // q_b
  scatter: number; // s_b (log gap)
  gap: number; // g_b (log gap; + is better than typical)
  dc: number; // delta c_b (constant)
  sampleError: number; // sample_b (constant)
  rateError: number; // rate_b (constant)
  weight: number; // w_b as a share of all the buckets' weight (0 to 1)
  comparisonCharts: number; // |P_b|
  widened: string | null; // the versions P_b used when the era alone had too few charts ("UNiVERSE–CiRCLE PLUS"), else null
};

/** Everything the rating bucket method says about one chart, for the page. */
export type MaishiftDetail = {
  bands: MaishiftBand[];
  rawDc: number; // step 8, before fitting to the level
  rawSigma: number;
  sample: number; rate: number; disagree: number; // rawSigma's three parts
  spread: number | null; // step 9: results' spread at this constant (null: too few charts to measure)
  spreadCharts: number;
  scale: number; // min(1, SPREAD_TARGET / spread)
  dc: number; // rawDc x scale
  sigma: number; // rawSigma x scale
  low: number; high: number; // the 95% range, as plays like values
  status: 'sure' | 'uncertain' | 'hidden';
  era: string;
  fetchedAt: string;
};

/** maishift's data, as loaded from maishift_levels, with an index from the site's charts to maishift's. */
export type MaishiftData = {
  levels: Map<number, MaishiftLevelDoc>;
  charts: Record<string, MaishiftChartInfo | null>;
  byChart: Map<string, number>;
  fetchedAt: string;
};

/** The key both sides share: folded title | standard / dx | basic ... remaster. */
export const maishiftKey = (title: string, kind: string, difficulty: string) =>
  `${songKey(title)}|${/dx/i.test(kind) ? 'dx' : 'standard'}|${difficulty.toLowerCase().replace(/[^a-z]/g, '')}`;

// a version's name -> its code (lib/versions.ts), for the era. "FESTiVAL PLUS" -> 23500
const CODE_BY_NAME = new Map(Object.entries(VERSION_NAMES).map(([code, name]) => [name.toLowerCase(), Number(code)]));
// maishift writes these versions' names in Japanese
for (const [name, code] of [['でらっくす', 20000], ['でらっくす plus', 20500], ['スプラッシュ', 21000], ['スプラッシュ plus', 21500]] as const) CODE_BY_NAME.set(name, code);
export const versionCodeOfName = (name: string | null | undefined) => (name ? CODE_BY_NAME.get(name.toLowerCase()) ?? null : null);
const eraOfCode = (code: number | null) => ERAS.findIndex((e) => (code ?? 0) >= e.from);
// every version in order, oldest first, for widening an era by the versions next to it
const VERSION_CODES = Object.keys(VERSION_NAMES).map(Number).sort((a, b) => a - b);
const versionIndexOfCode = (code: number | null) => {
  let index = -1;
  for (let i = 0; i < VERSION_CODES.length; i++) if (VERSION_CODES[i] <= (code ?? -1)) index = i;
  return index;
};
const versionIndexOfName = (name: string | null | undefined) => versionIndexOfCode(versionCodeOfName(name));
/** An era's versions, as [first, last] positions in VERSION_CODES. */
function eraVersionRange(era: number): [number, number] {
  const from = ERAS[era]?.from ?? 0;
  const to = era > 0 ? ERAS[era - 1].from : Infinity; // ERAS runs newest first
  const inside = VERSION_CODES.map((c, i) => [c, i]).filter(([c]) => c >= from && c < to).map(([, i]) => i);
  return [Math.min(...inside), Math.max(...inside)];
}

// maishift's rating buckets: 13000-13500, 13500-14000, then 250 wide up to 17000
const BANDS: Array<[number, number]> = [[13000, 13500], [13500, 14000]];
for (let from = 14000; from < 17000; from += 250) BANDS.push([from, from + 250]);
const groupOf = (rating: number) => Math.floor(rating / 250);
const positionOf = (bandFrom: number, constant: number) => groupOf(bandFrom) - groupOf(centerRating(constant));

/** B: the buckets a chart is compared in, BUCKETS_BELOW groups under its center rating's group to BUCKETS_ABOVE over. */
export function bandsFor(constant: number): Array<[number, number]> {
  const group = groupOf(centerRating(constant));
  const from = (group - BUCKETS_BELOW) * 250;
  const to = (group + BUCKETS_ABOVE) * 250 + 249;
  return BANDS.filter(([a, b]) => a <= to && b - 1 >= from);
}

/** Counts with any players the score ranks missed (an AP below AP+ only shows as a combo) counted as SSS+. */
export const fullCounts = (e: MaishiftEntry) => {
  const c = [...e.c];
  c[7] += Math.max(0, e.n - c.reduce((t, v) => t + v, 0));
  return c;
};

/** How the middle score is found, for the worked examples. */
export type MiddleWorking = { total: number; half: number; rank: number; below: number; inRank: number; low: number; high: number; middle: number; error: number };

/**
 * m and e: the middle player's accuracy, from rank counts (placed inside their rank as if that
 * rank's players were spread evenly), and the median's sampling error from grouped counts:
 * width x sqrt(players) / (2 x players in that rank). AP+ has no width: 0.5 is used.
 */
export function middleWorking(counts: number[]): MiddleWorking {
  const total = counts.reduce((t, v) => t + v, 0);
  let seen = 0;
  for (let i = 0; i < counts.length; i++) {
    if (seen + counts[i] >= total / 2) {
      const [low, high] = RANGES[i];
      const middle = counts[i] ? low + ((total / 2 - seen) / counts[i]) * (high - low) : low;
      const error = Math.max(0.01, (Math.max(high - low, 0.5) * Math.sqrt(Math.max(total, 1))) / (2 * Math.max(counts[i], 1)));
      return { total, half: total / 2, rank: i, below: seen, inRank: counts[i], low, high, middle, error };
    }
    seen += counts[i];
  }
  return { total, half: total / 2, rank: 8, below: total, inRank: 0, low: 101, high: 101, middle: 101, error: 0.5 };
}
export const middleScore = (counts: number[]) => middleWorking(counts).middle;

/** Step 4: a middle score as a log gap, and back. */
export const logGapOf = (m: number) => Math.log(101 - m + LOG_OFFSET);
export const scoreOfLogGap = (l: number) => 101 + LOG_OFFSET - Math.exp(l);
const round = (n: number, p: number) => Math.round(n * 10 ** p) / 10 ** p;
const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** The inverse of a small symmetric matrix (Gauss-Jordan). null if it can't be inverted. */
function inverse(m: number[][]): number[][] | null {
  const k = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < k; col++) {
    let pivot = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];
    for (let c = 0; c < 2 * k; c++) a[col][c] /= p;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = a[r][col];
      for (let c = 0; c < 2 * k; c++) a[r][c] -= f * a[col][c];
    }
  }
  return a.map((row) => row.slice(k));
}

/** Least squares of y on v with the coefficients' errors: b, (VᵀV)⁻¹, and the sums (VᵀV, Vᵀy) for the worked examples. */
export function leastSquares(rows: Array<{ v: number[]; y: number }>) {
  const k = rows[0]?.v.length ?? 0;
  const vtv = Array.from({ length: k }, () => new Array(k).fill(0));
  const vty = new Array(k).fill(0);
  for (const { v, y } of rows) {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) vtv[i][j] += v[i] * v[j];
      vty[i] += v[i] * y;
    }
  }
  const inv = inverse(vtv);
  if (!inv) return null;
  const b = inv.map((row) => row.reduce((t, x, j) => t + x * vty[j], 0));
  return { b, inv, vtv, vty };
}

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

/** One bucket's working, with what the worked examples show. */
export type BandWorking = MaishiftBand & {
  counts: number[];
  mid: MiddleWorking;
  fit: { b: number[]; vtv: number[][]; vty: number[]; rss: number };
  points: Array<[number, number]>; // [constant difference, log gap] for every pool chart
  samples: Array<{ id: number; d: number; n: number; middle: number; logGap: number }>; // three of them
  w: number;
};

/** Steps 1-8 for one chart: every bucket, combined. null when maishift has no usable bucket for it. */
export type MaishiftRaw = { constant: number; era: number; bands: BandWorking[]; dc: number; sigma: number; sample: number; rate: number; disagree: number; sumW: number; sumWdc: number; sumInvSample: number; sumDisagree: number };

export function maishiftRaw(constant: number, versionCode: number | null, maishiftId: number, data: MaishiftData): MaishiftRaw | null {
  const tenth = Math.round(constant * 10);
  const maxTenth = Math.round(MAX_CONSTANT * 10);
  // the pool reaches W either side, so every constant in it has to have been fetched (nothing is above MAX_CONSTANT)
  const reach: number[] = [];
  for (let t = tenth - REACH_TENTHS; t <= Math.min(maxTenth, tenth + REACH_TENTHS); t++) reach.push(t);
  if (!reach.every((t) => data.levels.has(t))) return null;
  const era = eraOfCode(versionCode);
  const bands: BandWorking[] = [];

  for (const [from, to] of bandsFor(constant)) {
    const key = `${from}-${to}`;
    const target = data.levels.get(tenth)?.bands[key]?.find((e) => e.id === maishiftId);
    if (!target) continue; // under 5 players here, or not fetched

    // P_b: same-era charts within W; with fewer than MIN_CHARTS, the versions just outside the era are added
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

    const position = positionOf(from, constant);

    // step 5: the typical line -l = a - S d + q d^2 (step 4's log gap, turned so higher is better), with the errors of a and S
    const rows = pool.map(({ d, m }) => ({ v: [1, d, d * d], y: -logGapOf(m) }));
    const fit = leastSquares(rows);
    if (!fit) continue;
    const [a, b1, q] = fit.b;
    const S = -b1;
    if (!(S > MIN_RATE)) continue; // scores don't change with constant here: this bucket can't tell charts apart
    const rss = rows.reduce((t, { v, y }) => t + (y - (a + b1 * v[1] + q * v[2])) ** 2, 0);
    const s = Math.max(SCATTER_MIN, Math.sqrt(rss / Math.max(1, rows.length - 3)));
    const typicalError = s * Math.sqrt(fit.inv[0][0]);
    const perConstantError = s * Math.sqrt(fit.inv[1][1]);

    // steps 6-7
    const counts = fullCounts(target);
    const mid = middleWorking(counts);
    const logGap = logGapOf(mid.middle);
    const logGapError = mid.error / (101 - mid.middle + LOG_OFFSET);
    const gap = -logGap - a;
    const dc = gap / S;
    const sampleError = Math.sqrt(logGapError ** 2 + typicalError ** 2) / S;
    const rateError = (Math.abs(dc) * perConstantError) / S;
    const pick = [...pool].sort((x, y) => x.d - y.d || y.e.n - x.e.n);
    const samples = [pick[0], pick.find((x) => x.d === 0) ?? pick[Math.floor(pick.length / 2)], pick[pick.length - 1]]
      .map(({ e, d, m }) => ({ id: e.id, d, n: e.n, middle: m, logGap: logGapOf(m) }));

    bands.push({
      from, to: to - 1, position, players: target.n,
      middle: mid.middle, middleError: mid.error, logGap, logGapError,
      typicalLogGap: -a, typicalScore: scoreOfLogGap(-a), typicalError, perConstant: S, perConstantError, curve: q, scatter: s,
      gap, dc, sampleError, rateError, weight: 0, comparisonCharts: pool.length, widened,
      counts, mid,
      fit: { b: fit.b, vtv: fit.vtv, vty: fit.vty, rss },
      points: rows.map(({ v, y }) => [v[1], -y]),
      samples,
      w: 1 / (sampleError ** 2 + rateError ** 2),
    });
  }
  if (!bands.length) return null;

  const sumW = bands.reduce((t, b) => t + b.w, 0);
  for (const b of bands) b.weight = b.w / sumW;
  const sumWdc = bands.reduce((t, b) => t + b.w * b.dc, 0);
  const dc = sumWdc / sumW;
  const sumInvSample = bands.reduce((t, b) => t + 1 / b.sampleError ** 2, 0);
  const sample = 1 / Math.sqrt(sumInvSample);
  const rate = bands.reduce((t, b) => t + b.w * b.rateError, 0) / sumW;
  const sumDisagree = bands.reduce((t, b) => t + b.w * (b.dc - dc) ** 2, 0);
  const disagree = bands.length > 1 ? Math.sqrt(sumDisagree / sumW / (bands.length - 1)) : SINGLE_BUCKET_DISAGREE;
  const sigma = Math.sqrt(sample ** 2 + rate ** 2 + disagree ** 2);
  return { constant, era, bands, dc, sigma, sample, rate, disagree, sumW, sumWdc, sumInvSample, sumDisagree };
}

/** Step 10's rule, on dc and sigma already fitted to the level. */
export const statusOf = (dc: number, sigma: number): MaishiftDetail['status'] =>
  2 * sigma <= SURE_RANGE ? 'sure' : Math.abs(dc) > 2 * sigma ? 'uncertain' : 'hidden';
const playsLikeOf = (constant: number, dc: number) => Math.min(MAX_CONSTANT, Math.round((constant - Math.max(-CAP, Math.min(CAP, dc))) * 10) / 10);

/** Step 9's spreads: every maishift chart's raw result, by constant. Worked out once per data. */
export type Spreads = { byTenth: Map<number, number[]> };
const spreadCache = new WeakMap<MaishiftData, Spreads>();
export function spreadsFor(data: MaishiftData): Spreads {
  const cached = spreadCache.get(data);
  if (cached) return cached;
  const byTenth = new Map<number, number[]>();
  for (const [tenth, doc] of data.levels) {
    const ids = new Set(Object.values(doc.bands).flatMap((list) => list.map((e) => e.id)));
    for (const id of ids) {
      const raw = maishiftRaw(tenth / 10, versionCodeOfName(data.charts[id]?.version), id, data);
      if (!raw || statusOf(raw.dc, raw.sigma) === 'hidden') continue; // only results that would be shown
      byTenth.set(tenth, [...(byTenth.get(tenth) ?? []), raw.dc]);
    }
  }
  const spreads = { byTenth };
  spreadCache.set(data, spreads);
  return spreads;
}

/** Step 9 at one constant: the spread (1.4826 x median distance from the median), widening to the constants next to it when there are too few charts. */
export function spreadAt(constant: number, spreads: Spreads): { spread: number | null; charts: number } {
  const tenth = Math.round(constant * 10);
  for (let reach = 0; reach <= 2; reach++) {
    const values: number[] = [];
    for (let t = tenth - reach; t <= tenth + reach; t++) values.push(...(spreads.byTenth.get(t) ?? []));
    if (values.length >= SPREAD_MIN_CHARTS) {
      const mid = median(values);
      return { spread: 1.4826 * median(values.map((v) => Math.abs(v - mid))), charts: values.length };
    }
  }
  return { spread: null, charts: 0 };
}

/** Steps 9-10, from a chart's raw result: the ChartFeel the site saves. */
export function maishiftFinish(raw: MaishiftRaw, data: MaishiftData, spreads = spreadsFor(data)): ChartFeel {
  const { constant, bands } = raw;
  const tenth = Math.round(constant * 10);
  const maxTenth = Math.round(MAX_CONSTANT * 10);
  const { spread, charts } = spreadAt(constant, spreads);
  const scale = spread && spread > 0 ? Math.min(1, SPREAD_TARGET / spread) : 1;
  const dc = raw.dc * scale;
  const sigma = raw.sigma * scale;
  const status = statusOf(dc, sigma);
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
    playsLike: status === 'hidden' ? null : playsLikeOf(constant, dc),
    playsLikeLow: playsLikeOf(constant, dc + 2 * sigma),
    playsLikeHigh: playsLikeOf(constant, dc - 2 * sigma),
    sigma: round(sigma, 3),
    unsure: status !== 'sure',
    lowSample: players < MIN_PLAYERS,
    groups: [],
    maishift: {
      bands: bands.map((b) => ({
        from: b.from, to: b.to, position: b.position, players: b.players,
        middle: round(b.middle, 3), middleError: round(b.middleError, 4), logGap: round(b.logGap, 4), logGapError: round(b.logGapError, 4),
        typicalLogGap: round(b.typicalLogGap, 4), typicalScore: round(b.typicalScore, 3), typicalError: round(b.typicalError, 4),
        perConstant: round(b.perConstant, 3), perConstantError: round(b.perConstantError, 4), curve: round(b.curve, 3), scatter: round(b.scatter, 3),
        gap: round(b.gap, 3), dc: round(b.dc, 3), sampleError: round(b.sampleError, 4), rateError: round(b.rateError, 4), weight: round(b.weight, 3),
        comparisonCharts: b.comparisonCharts, widened: b.widened,
      })),
      rawDc: round(raw.dc, 3), rawSigma: round(raw.sigma, 3),
      sample: round(raw.sample, 4), rate: round(raw.rate, 4), disagree: round(raw.disagree, 4),
      spread: spread == null ? null : round(spread, 3), spreadCharts: charts, scale: round(scale, 3),
      dc: round(dc, 3), sigma: round(sigma, 3),
      low: playsLikeOf(constant, dc + 2 * sigma), high: playsLikeOf(constant, dc - 2 * sigma),
      status,
      era: ERAS[raw.era]?.label ?? 'all versions',
      fetchedAt: data.fetchedAt,
    },
  };
}

/** "Plays like" for one chart by the rating bucket method, or null when maishift has no numbers for it. */
export function maishiftFeel(constant: number, versionCode: number | null, maishiftId: number, data: MaishiftData): ChartFeel | null {
  const raw = maishiftRaw(constant, versionCode, maishiftId, data);
  return raw ? maishiftFinish(raw, data) : null;
}
