import { toNormalWidth, type Song } from './leaderboard';

/**
 * Scores from the japanese maimai DX NET, for the one player who has them (GF_USER_ID,
 * lib/special-players.ts). rating-scraper/scrape-jp-scores.js saves them as jp_songs on
 * her player, next to her international scores (songs). When she has them switched on
 * (show_jp_scores on her account, the account menu's "show japan scores"), her profile
 * uses her best of both: each chart's higher score, from whichever version it came
 * from. Those from japan are marked source: 'jp', which the score cards show.
 *
 * Everything on the profile that reads scores (best 50, level breakdown, play stats,
 * favorites) then uses the combined list. Her rating at the top and on the leaderboard
 * stays the international one, which comes from maimai NET itself.
 */

// one chart, across both versions: kind + difficulty + title (as the scrapers match titles)
const chartKey = (s: Song) =>
  `${s.kind}|${s.difficulty}|${toNormalWidth(String(s.title ?? '')).replace(/\s+/g, ' ').trim().toLowerCase()}`;

export function mergeJpScores(intl: Song[] = [], jp: Song[] = []): Song[] {
  const byChart = new Map<string, Song>();
  for (const s of intl) byChart.set(chartKey(s), s);
  for (const s of jp) {
    const key = chartKey(s);
    const theirs = byChart.get(key);
    // japan's only when it's better: a tie keeps the international one
    if (!theirs || (s.achievement ?? 0) > (theirs.achievement ?? 0)) byChart.set(key, { ...s, source: 'jp' });
  }
  return [...byChart.values()];
}
