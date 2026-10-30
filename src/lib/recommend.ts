import { unstable_cache } from 'next/cache';
import { connectMongo } from './connect-db';
import { SONG_DATA_TAG } from './song-data';
import { songKey } from './song-id';

/**
 * How players at a rating do on each chart, from maishift (https://maimai.shiftpsh.com),
 * for the charts page's "recommended" filter (lib/my-charts.ts). The scraper copies it
 * nightly into maishift_stats, one document per rating band (rating-scraper
 * fetch-maishift-stats.js). Server only.
 */

export type BandChart = { players: number; sssPlus: number };
// by chartKey(title, artist, kind, difficulty) below
export type BandStats = { from: number; to: number; charts: Map<string, BandChart> };

type BandDoc = { _id: string; from: number; to: number; charts: { title: string; artist: string | null; kind: string; difficulty: string; players: number; sssPlus: number }[] };

/** A chart's key, the same from maishift's side and ours. The artist tells apart two songs sharing a title. */
export const chartKey = (title: string, artist: string | null, kind: string, difficulty: string) =>
  `${songKey(title)}|${songKey(artist ?? '')}|${kind}|${difficulty}`;
/** The same without the artist, for a title only one song has. */
export const chartKeyNoArtist = (title: string, kind: string, difficulty: string) => `${songKey(title)}||${kind}|${difficulty}`;

// which bands are saved (just their ranges), then each band on its own: all of them together
// are ~3 MB, over the 2 MB the cache keeps, and a player only ever needs one. none saved yet
// throws rather than returning [], so that isn't kept for 6 hours: it's asked again next time
const readBandRanges = unstable_cache(
  async (): Promise<Pick<BandDoc, '_id' | 'from' | 'to'>[]> => {
    const docs = await (await connectMongo()).db('maimai').collection<BandDoc>('maishift_stats')
      .find({}, { projection: { from: 1, to: 1 } }).toArray();
    if (docs.length === 0) throw new Error('no maishift stats saved yet');
    return JSON.parse(JSON.stringify(docs));
  },
  ['maishift-bands-v1'],
  { revalidate: 6 * 60 * 60, tags: [SONG_DATA_TAG] },
);

const readBand = (id: string) =>
  unstable_cache(
    async (): Promise<BandDoc | null> => {
      const doc = await (await connectMongo()).db('maimai').collection<BandDoc>('maishift_stats').findOne({ _id: id });
      return doc ? JSON.parse(JSON.stringify(doc)) : null;
    },
    ['maishift-band-v1', id],
    { revalidate: 6 * 60 * 60, tags: [SONG_DATA_TAG] },
  )();

/**
 * The band a rating falls in, or the closest one we have. null under 13000 (maishift has no
 * band that low, and its lowest band's players are too far ahead to go by), and before the
 * scraper has saved any.
 */
export async function bandStatsFor(rating: number): Promise<BandStats | null> {
  if (rating < 13000) return null;
  const ranges = await readBandRanges().catch(() => []);
  if (ranges.length === 0) return null;
  const distance = (b: { from: number; to: number }) => (rating < b.from ? b.from - rating : rating >= b.to ? rating - b.to + 1 : 0);
  const closest = ranges.reduce((best, b) => (distance(b) < distance(best) ? b : best));
  const band = await readBand(closest._id);
  if (!band) return null;

  const charts = new Map<string, BandChart>();
  for (const c of band.charts) {
    const stat = { players: c.players, sssPlus: c.sssPlus };
    charts.set(chartKey(c.title, c.artist, c.kind, c.difficulty), stat);
    charts.set(chartKeyNoArtist(c.title, c.kind, c.difficulty), stat); // last one wins for a shared title; the artist key is tried first
  }
  return { from: band.from, to: band.to, charts };
}
