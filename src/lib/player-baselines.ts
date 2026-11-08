import { SCORE_FLOOR, type PlayerBaseline } from './plays-like';

/**
 * One player's scores summed by constant, for "plays like" (lib/plays-like.ts):
 * { rating, tenths of constant -> [sum of accuracy, charts] }. Scores under 94% count as 94%
 * (SCORE_FLOOR): fails and first tries would otherwise drag their usual score down.
 *
 * Plain module. lib/chart-feel-store.ts reads every player's scores and builds these when it
 * updates the saved results.
 */
export function playerBaseline(
  rating: number,
  scores: Array<{ internal_difficulty?: number | null; achievement?: number | null }>,
): PlayerBaseline {
  const byConstant: PlayerBaseline['byConstant'] = {};
  for (const { internal_difficulty: constant, achievement } of scores) {
    if (constant == null || achievement == null || !(achievement > 0)) continue;
    const tenth = Math.round(constant * 10);
    const entry = byConstant[tenth] ?? (byConstant[tenth] = [0, 0]);
    entry[0] += Math.max(SCORE_FLOOR, achievement);
    entry[1] += 1;
  }
  return { rating: Number(rating) || 0, byConstant };
}
