import { songKey } from './song-id';
import { VERSION_NAMES } from './versions';
import { CAP, ERAS, K, MAX_CONSTANT, MIN_PLAYERS, centerRating, type ChartFeel } from './plays-like';

/**
 * "Plays like" from maishift's data (lib/plays-like.ts has the version from this site's own
 * players). maishift gives, for every chart, how many players in each rating band got each
 * rank (scripts/fetch-maishift-song.mjs saves it; it's imported into maishift_levels).
 * Plain module, so it can be tested on its own.
 *
 * For each rating band within 750 of the chart's center rating (an SSS+ on it x 50):
 *   1. middle score: the accuracy of the middle player, from the rank counts (where in a
 *      rank's range the middle falls is spread evenly: SS+ covers 99.5-100, and so on)
 *   2. popularity: charts more players have played get practised more and score higher.
 *      The middle score gained per doubling of players is measured among the comparison
 *      charts and taken back out
 *   3. compared with charts from the same era (ERAS) within 0.1 of the constant, in the same
 *      band, as a z score: (adjusted middle - their mean) / their spread. + is easier
 * The bands' z scores are averaged, weighted by the chart's players in each, and
 * plays like = constant - z x K, moved at most CAP, never above MAX_CONSTANT. The same
 * K and CAP as the site's own version.
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

/** One band's numbers, for the bars and the popup. */
export type MaishiftBand = {
  from: number; to: number; // the band: 14,750 to 14,999
  players: number; // this chart's players in it
  shares: number[]; // their ranks, as fractions (RANKS order)
  typical: number[]; // the same for the comparison charts at this constant, together
  middle: number; // this chart's middle score
  typicalMiddle: number; // the comparison charts' together
  z: number; // how far from them, after the popularity correction
  comparisonCharts: number;
  perDoubling: number; // middle score gained per doubling of players, in this band
};

/** Everything maishift's data says about one chart, for the page. */
export type MaishiftDetail = { bands: MaishiftBand[]; z: number; era: string; fetchedAt: string };

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
const eraOfName = (name: string | null | undefined) => {
  const code = name ? CODE_BY_NAME.get(name.toLowerCase()) ?? null : null;
  return code == null ? -1 : ERAS.findIndex((e) => code >= e.from);
};
const eraOfCode = (code: number | null) => ERAS.findIndex((e) => (code ?? 0) >= e.from);

// maishift's rating bands: 13000-13500, 13500-14000, then 250 wide up to 17000
const BANDS: Array<[number, number]> = [[13000, 13500], [13500, 14000]];
for (let from = 14000; from < 17000; from += 250) BANDS.push([from, from + 250]);

/** The bands a chart is compared in: within 3 rating groups (750) of its center rating. */
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

/** The middle player's accuracy, from rank counts. */
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
const sd = (v: number[]) => { const m = mean(v); return Math.sqrt(v.reduce((t, x) => t + (x - m) ** 2, 0) / v.length); };
const log2 = (n: number) => Math.log2(Math.max(1, n));
const round = (n: number, p: number) => Math.round(n * 10 ** p) / 10 ** p;
const shares = (counts: number[]) => { const t = counts.reduce((a, b) => a + b, 0) || 1; return counts.map((v) => round(v / t, 4)); };
const MIN_COMPARISON = 5;
const MIN_SPREAD = 0.1;

/** "Plays like" for one chart from maishift's data, or null when it has none for that chart. */
export function maishiftFeel(constant: number, versionCode: number | null, maishiftId: number, data: MaishiftData): ChartFeel | null {
  const tenth = Math.round(constant * 10);
  // the chart is compared with charts within 0.1, so all three constants have to have been fetched
  if (![tenth - 1, tenth, tenth + 1].every((t) => data.levels.has(t))) return null;
  const era = eraOfCode(versionCode);
  const bands: MaishiftBand[] = [];
  let usedEra = ERAS[era]?.label ?? 'all versions';

  for (const [from, to] of bandsFor(constant)) {
    const key = `${from}-${to}`;
    const target = data.levels.get(tenth)?.bands[key]?.find((e) => e.id === maishiftId);
    if (!target) continue; // under 5 players here, or not fetched

    // charts within 0.1, same era first, every era if there aren't enough
    const near = [tenth - 1, tenth, tenth + 1].map((t) => ({ t, list: data.levels.get(t)?.bands[key] ?? [] }));
    let cells = near.map(({ t, list }) => ({ t, list: list.filter((e) => eraOfName(data.charts[e.id]?.version) === era) }));
    if (cells.reduce((n, c) => n + c.list.length, 0) < MIN_COMPARISON) {
      cells = near;
      usedEra = 'all versions';
    }
    const all = cells.flatMap((c) => c.list);
    if (all.length < MIN_COMPARISON) continue;

    // popularity: middle score per doubling of players, within each constant, pooled
    let sxy = 0;
    let sxx = 0;
    for (const { list } of cells) {
      if (list.length < 2) continue;
      const mx = mean(list.map((e) => log2(e.n)));
      const my = mean(list.map((e) => middleScore(fullCounts(e))));
      for (const e of list) { sxy += (log2(e.n) - mx) * (middleScore(fullCounts(e)) - my); sxx += (log2(e.n) - mx) ** 2; }
    }
    const perDoubling = sxx > 0 ? Math.max(0, sxy / sxx) : 0;
    const averageLog = mean(all.map((e) => log2(e.n)));
    const adjust = (e: MaishiftEntry) => middleScore(fullCounts(e)) - perDoubling * (log2(e.n) - averageLog);
    const adjusted = all.map(adjust);
    const z = (adjust(target) - mean(adjusted)) / Math.max(MIN_SPREAD, sd(adjusted));

    // the comparison charts at this very constant, added together, for the "typical" bar
    const same = (cells.find((c) => c.t === tenth)?.list ?? []).filter((e) => e.id !== maishiftId);
    const pooled = (same.length ? same : all).reduce((t, e) => t.map((v, i) => v + fullCounts(e)[i]), new Array(9).fill(0));

    bands.push({
      from, to: to - 1, players: target.n,
      shares: shares(fullCounts(target)), typical: shares(pooled),
      middle: round(middleScore(fullCounts(target)), 3), typicalMiddle: round(middleScore(pooled), 3),
      z: round(z, 2), comparisonCharts: all.length, perDoubling: round(perDoubling, 3),
    });
  }
  if (!bands.length) return null;

  const players = bands.reduce((t, b) => t + b.players, 0);
  const z = bands.reduce((t, b) => t + b.z * b.players, 0) / players;
  const move = Math.max(-CAP, Math.min(CAP, -z * K));
  return {
    source: 'maishift',
    needed: MIN_PLAYERS,
    counted: players,
    allRatings: false,
    ratingFrom: bands[0].from,
    ratingTo: bands[bands.length - 1].to,
    baselineFrom: (tenth - 1) / 10,
    baselineTo: (tenth + 1) / 10,
    playsLike: Math.min(MAX_CONSTANT, Math.round((constant + move) * 10) / 10),
    lowSample: players < MIN_PLAYERS,
    groups: [],
    maishift: { bands, z: round(z, 2), era: usedEra, fetchedAt: data.fetchedAt },
  };
}
