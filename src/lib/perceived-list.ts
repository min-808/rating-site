import { unstable_cache } from 'next/cache';
import { connectMongo } from './connect-db';
import { getCatalog } from './song-catalog';
import { chartId } from './song-view';
import { NEW_POOL_VERSIONS } from './versions';
import type { ChartFeel } from './plays-like';

/**
 * The "plays harder / easier" tab (app/charts/perceived): every US-available EXPERT, MASTER and
 * Re:MASTER chart whose saved "plays like" (lib/chart-feel-store.ts, the rating bucket method)
 * differs from its constant, packed small for the browser. Only maishift results (sure or marked
 * uncertain; hidden ones have no plays like). Read once and kept for an hour, so the page makes
 * one small query an hour at most.
 */

/** One chart: [song id, title, jacket, dx (1) or standard (0), difficulty, new song (1: counts toward B15), constant, plays like, low, high, sure (1), change before the cap] */
export type PerceivedRow = [string, string, string | null, 0 | 1, 'expert' | 'master' | 'remaster', 0 | 1, number, number, number, number, 0 | 1, number];

const SHOWN = new Set(['expert', 'master', 'remaster']);

type Doc = { _id: string; songId: string; chart: string; constant: number; feel: Pick<ChartFeel, 'source' | 'playsLike' | 'playsLikeLow' | 'playsLikeHigh' | 'unsure'> & { maishift?: { dc: number } } };

async function build(): Promise<{ rows: PerceivedRow[]; jacketBase: string }> {
  const db = (await connectMongo()).db('maimai');
  const [catalog, docs] = await Promise.all([
    getCatalog(),
    db.collection<Doc>('chart_feel').find(
      { 'feel.source': 'maishift', 'feel.playsLike': { $ne: null } },
      { projection: { songId: 1, chart: 1, constant: 1, 'feel.playsLike': 1, 'feel.playsLikeLow': 1, 'feel.playsLikeHigh': 1, 'feel.unsure': 1, 'feel.maishift.dc': 1 } },
    ).toArray(),
  ]);
  const songs = new Map(catalog.filter((s) => s.na).map((s) => [s.id, s]));
  const rows: PerceivedRow[] = [];
  for (const d of docs) {
    const song = songs.get(d.songId);
    const chart = song?.charts.find((c) => chartId(c) === d.chart);
    const playsLike = d.feel.playsLike;
    if (!song || !chart || !SHOWN.has(chart.difficulty) || playsLike == null) continue;
    if (Math.round(playsLike * 10) === Math.round(chart.internal * 10)) continue; // plays like its constant: not on either list
    rows.push([
      song.id, song.title, song.jacket, chart.kind === 'dx' ? 1 : 0, chart.difficulty as PerceivedRow[4],
      song.version && NEW_POOL_VERSIONS.includes(song.version) ? 1 : 0,
      chart.internal, playsLike, d.feel.playsLikeLow ?? playsLike, d.feel.playsLikeHigh ?? playsLike,
      d.feel.unsure ? 0 : 1, Math.round((d.feel.maishift?.dc ?? chart.internal - playsLike) * 1000) / 1000,
    ]);
  }
  // every jacket address starts the same way: sent once (like lib/song-catalog.ts toBrowserList)
  const jackets = rows.map((r) => r[2]).filter((j): j is string => Boolean(j));
  let base = jackets[0] ?? '';
  for (const j of jackets) while (base && !j.startsWith(base)) base = base.slice(0, -1);
  base = base.slice(0, base.lastIndexOf('/') + 1);
  if (base.length < 12) return { rows, jacketBase: '' };
  return { rows: rows.map((r) => { const c = [...r] as PerceivedRow; c[2] = r[2] ? r[2].slice(base.length) : null; return c; }), jacketBase: base };
}

export const getPerceivedList = unstable_cache(build, ['perceived-list-v1'], { revalidate: 3600 });
