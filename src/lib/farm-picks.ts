import { new15, old35, rateSong, RATING_CAP } from './song-calc';
import { NEW_POOL_VERSIONS } from './versions';
import { catalogByTitle, songForScore, type CatalogSong } from './song-catalog';
import type { Song } from './leaderboard';

/**
 * Rating-farm picks (experimental): charts that would raise a player's rating, play easier than
 * their constant, and sit in the range the player's best 50 feels like. From their scores, the
 * song catalog and the saved "plays like" results (lib/farm-feels.ts). Plain module.
 *
 * Only US international charts: the song isn't japan-only or marked unavailable in North America
 * (catalog na), and its plays like comes from maishift's NA players.
 *
 * Felt range: the plays like of each chart in their best 50 (its constant when there's none).
 * Comfortable = the middle half (25th to 75th percentile); reach = up to the 90th.
 *
 * A chart qualifies when:
 *   1. they haven't SSS+'d it (best under 100.5%, or never played)
 *   2. an SSS+ on it would raise their rating: it beats the floor of the half it joins (B15 for
 *      the new versions, B35 for the rest), or what it's worth now when it's in their best 50.
 *      gain = that difference
 *   3. it plays easier: plays like at least MIN_EASIER under the constant
 *   4. plays like is from BELOW_RANGE under the comfortable range up to the top of the reach
 * Likely score: their USUAL_QUANTILE score on the charts they've played whose constant is within
 * USUAL_REACH of this chart's plays like (at least USUAL_MIN charts, else twice as wide), capped
 * at SSS+. likelyGain = what that score on the real constant adds (0 if nothing).
 * Weight = (easier + rating + fit) x 0.5 if plays like is uncertain, each part 0 to 1:
 *   easier = (constant - plays like) / 0.5
 *   rating = likelyGain / the biggest likelyGain on their list
 *   fit    = 1 inside the comfortable range, falling to 0 at FIT_FADE outside it
 */

export const MIN_EASIER = 0.1;
export const BELOW_RANGE = 0.3;
export const FIT_FADE = 0.3;
export const UNSURE_FACTOR = 0.5;
export const USUAL_REACH = 0.2;
export const USUAL_MIN = 3;
export const USUAL_QUANTILE = 0.75;
/** How many of the heaviest picks go to the page, from each half (B35 and B15), so either can be shown on its own. */
export const KEEP = 25;

/** What a saved "plays like" result needs to carry here (lib/farm-feels.ts). */
export type FarmFeel = {
  playsLike: number; low: number | null; high: number | null; unsure: boolean;
  players: number; buckets: number;
  top: { from: number; to: number; players: number; middle: number; typical: number; weight: number } | null;
};

export type FarmPick = {
  songId: string; title: string; jacket: string | null;
  kind: 'standard' | 'dx'; difficulty: string; level: string | null; constant: number; pool: 'new' | 'old';
  current: number | null; inBest50: boolean;
  feel: FarmFeel;
  gain: number; usual: number | null; likelyGain: number;
  disparity: number; easier: number; rating: number; fit: number; weight: number;
};
export type FarmRange = { mean: number; q25: number; q75: number; q90: number };
export type FarmPicks = { range: FarmRange | null; playerConstant: number; total: number; totals?: { old: number; new: number }; picks: FarmPick[] };

const diffKey = (d: string | undefined) => String(d ?? '').toLowerCase().replace(/[^a-z]/g, '');
const kindOf = (k: string | undefined) => (/dx/i.test(k ?? '') ? 'dx' : 'standard');
const sssPlus = (constant: number) => rateSong({ achievement: RATING_CAP, internal_difficulty: constant, ap: false } as Song);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number, p: number) => Math.round(x * 10 ** p) / 10 ** p;

/** feelId: the saved result's key for a chart (lib/chart-feel-store.ts, chartFeelId). */
export function buildFarmPicks(scores: Song[], catalog: CatalogSong[], feels: Map<string, FarmFeel>, feelId: (songId: string, chart: { kind: string; difficulty: string }) => string): FarmPicks {
  const index = catalogByTitle(catalog);
  const b15 = new15(scores);
  const b35 = old35(scores);
  const floorOf = (best: Song[], size: number) => (best.length < size ? 0 : Math.min(...best.map(rateSong)));
  const floors = { new: floorOf(b15, 15), old: floorOf(b35, 35) };
  const best50 = [...b15, ...b35];
  const playerConstant = best50.length ? best50.reduce((t, s) => t + Number(s.internal_difficulty), 0) / best50.length : 0;

  const key = (songId: string, kind: string, difficulty: string) => `${songId}|${kind}|${difficulty}`;
  const own = new Map<string, Song>();
  for (const s of scores) {
    const song = songForScore(index, s);
    if (!song) continue;
    const k = key(song.id, kindOf(s.kind), diffKey(s.difficulty));
    const prev = own.get(k);
    if (!prev || Number(s.achievement) > Number(prev.achievement)) own.set(k, s);
  }
  const inBest = new Set<string>();
  const felt: number[] = [];
  for (const s of best50) {
    const song = songForScore(index, s);
    const feel = song ? feels.get(feelId(song.id, { kind: kindOf(s.kind), difficulty: diffKey(s.difficulty) })) : undefined;
    if (song) inBest.add(key(song.id, kindOf(s.kind), diffKey(s.difficulty)));
    felt.push(feel?.playsLike ?? Number(s.internal_difficulty));
  }
  felt.sort((a, b) => a - b);
  const q = (p: number) => felt[Math.floor(p * (felt.length - 1))];
  const range: FarmRange | null = felt.length
    ? { mean: round(felt.reduce((t, x) => t + x, 0) / felt.length, 2), q25: q(0.25), q75: q(0.75), q90: q(0.9) }
    : null;
  if (!range) return { range: null, playerConstant: 0, total: 0, picks: [] };

  // their likely score at a level: a good score of theirs on charts of about that constant
  const mine = [...own.values()].filter((x) => Number(x.achievement) > 0 && x.internal_difficulty != null);
  const usualAt = (level: number) => {
    for (const reach of [USUAL_REACH, USUAL_REACH * 2]) {
      const near = mine.filter((x) => Math.abs(Number(x.internal_difficulty) - level) <= reach + 1e-9);
      if (near.length >= USUAL_MIN) {
        const sorted = near.map((x) => Number(x.achievement)).sort((a, b) => a - b);
        return Math.min(RATING_CAP, sorted[Math.floor(USUAL_QUANTILE * (sorted.length - 1))]);
      }
    }
    return null;
  };

  const raw: Omit<FarmPick, 'rating' | 'weight'>[] = [];
  for (const song of catalog) {
    if (!song.na) continue; // US international only
    const pool = song.version !== null && NEW_POOL_VERSIONS.includes(song.version) ? 'new' : 'old';
    for (const chart of song.charts) {
      const feel = feels.get(feelId(song.id, chart)); // maishift (NA players) results only
      if (!feel) continue;
      const k = key(song.id, chart.kind, diffKey(chart.difficulty));
      const best = own.get(k);
      if (best && Number(best.achievement) >= RATING_CAP) continue; // 1
      const inBest50 = inBest.has(k);
      const base = inBest50 && best ? rateSong(best) : floors[pool];
      const gain = sssPlus(chart.internal) - base; // 2
      if (gain <= 0) continue;
      const disparity = round(chart.internal - feel.playsLike, 1); // 3
      if (disparity < MIN_EASIER - 1e-9) continue;
      if (feel.playsLike < range.q25 - BELOW_RANGE - 1e-9 || feel.playsLike > range.q90 + 1e-9) continue; // 4
      const usual = usualAt(feel.playsLike);
      const likely = usual == null ? 0 : rateSong({ achievement: usual, internal_difficulty: chart.internal, ap: false } as Song);
      const outside = feel.playsLike < range.q25 ? range.q25 - feel.playsLike : feel.playsLike > range.q75 ? feel.playsLike - range.q75 : 0;
      raw.push({
        songId: song.id, title: song.title, jacket: song.jacket,
        kind: chart.kind, difficulty: chart.difficulty, level: chart.level, constant: chart.internal, pool,
        current: best ? Number(best.achievement) : null, inBest50, feel, gain,
        usual: usual == null ? null : round(usual, 4), likelyGain: Math.max(0, likely - base),
        disparity, easier: clamp01(disparity / 0.5), fit: round(clamp01(1 - outside / FIT_FADE), 3),
      });
    }
  }
  const maxLikely = Math.max(1, ...raw.map((c) => c.likelyGain));
  const picks = raw
    .map((c) => {
      const rating = round(c.likelyGain / maxLikely, 3);
      return { ...c, rating, weight: round((c.easier + rating + c.fit) * (c.feel.unsure ? UNSURE_FACTOR : 1), 3) };
    })
    .sort((a, b) => b.weight - a.weight);
  const kept = [...picks.filter((c) => c.pool === 'old').slice(0, KEEP), ...picks.filter((c) => c.pool === 'new').slice(0, KEEP)].sort((a, b) => b.weight - a.weight);
  return { range, playerConstant: round(playerConstant, 2), total: picks.length, totals: { old: picks.filter((c) => c.pool === 'old').length, new: picks.filter((c) => c.pool === 'new').length }, picks: kept };
}

/** count charts drawn without repeats, each one's chance proportional to its weight (all of them when there are fewer). */
export function drawWeighted<T extends { weight: number }>(list: T[], count = 5, random = Math.random): T[] {
  return list
    .map((item) => ({ item, key: Math.pow(random(), 1 / Math.max(item.weight, 1e-6)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, count)
    .map((x) => x.item);
}
