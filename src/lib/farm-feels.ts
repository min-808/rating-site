import { unstable_cache } from 'next/cache';
import { connectMongo } from './connect-db';
import type { ChartFeel } from './plays-like';
import type { FarmFeel } from './farm-picks';

/**
 * The saved "plays like" results the rating-farm picks use (lib/farm-picks.ts): only those from
 * maishift's NA players, each cut down to what the picks show (the bucket with the most say,
 * not every bucket), so all of them fit the cache. Kept for an hour. Server only.
 */
type Row = [string, number, number | null, number | null, 0 | 1, number, number, [number, number, number, number, number, number] | null];

const readFeels = unstable_cache(
  async (): Promise<Row[]> => {
    const docs = await (await connectMongo()).db('maimai').collection<{ _id: string; feel: ChartFeel }>('chart_feel').find(
      { 'feel.source': 'maishift', 'feel.playsLike': { $ne: null } },
      { projection: { _id: 1, 'feel.playsLike': 1, 'feel.playsLikeLow': 1, 'feel.playsLikeHigh': 1, 'feel.unsure': 1, 'feel.counted': 1,
        'feel.maishift.bands.from': 1, 'feel.maishift.bands.to': 1, 'feel.maishift.bands.players': 1, 'feel.maishift.bands.adjusted': 1, 'feel.maishift.bands.typicalScore': 1, 'feel.maishift.bands.weight': 1 } },
    ).toArray();
    return docs.map((d) => {
      const bands = d.feel.maishift?.bands ?? [];
      const top = bands.reduce<(typeof bands)[number] | null>((best, b) => (!best || b.weight > best.weight ? b : best), null);
      return [d._id, d.feel.playsLike as number, d.feel.playsLikeLow ?? null, d.feel.playsLikeHigh ?? null, d.feel.unsure ? 1 : 0, d.feel.counted, bands.length,
        top ? [top.from, top.to, top.players, top.adjusted, top.typicalScore, top.weight] : null];
    });
  },
  ['farm-feels-v1'],
  { revalidate: 60 * 60 },
);

export async function getFarmFeels(): Promise<Map<string, FarmFeel>> {
  const rows = await readFeels();
  return new Map(rows.map(([id, playsLike, low, high, unsure, players, buckets, top]) => [id, {
    playsLike, low, high, unsure: unsure === 1, players, buckets,
    top: top && { from: top[0], to: top[1], players: top[2], middle: top[3], typical: top[4], weight: top[5] },
  }]));
}
