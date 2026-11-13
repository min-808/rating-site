import { NextResponse } from 'next/server';
import { connectMongo } from '../../../../lib/connect-db';

/**
 * GET /api/chart-feel/stats   development only: how the saved "plays like" results came out,
 * to check the method's settings. How many charts have one, how many hit the cap (CAP), how
 * far charts move, and the measured accuracy per constant (S) by level, for this site's data
 * and maishift's. Reads only a few small fields per chart.
 */
export const dynamic = 'force-dynamic';

type Doc = { constant: number; feel: { playsLike: number | null; lowSample?: boolean; source?: string; working?: { dc: number; perConstant: number }; maishift?: { dc: number; bands: Array<{ perConstant: number; weight: number }> } } };

const quantile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(p * (sorted.length - 1))] * 1000) / 1000;
};

export async function GET() {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'development only' }, { status: 404 });
  try {
    return await stats();
  } catch (error) {
    return NextResponse.json({ error: String((error as Error)?.message ?? error).slice(0, 300) }, { status: 500 });
  }
}

async function stats() {
  const client = await connectMongo();
  const docs = await client.db('maimai').collection<Doc>('chart_feel').find(
    { 'feel.playsLike': { $ne: null } },
    { projection: { _id: 0, constant: 1, 'feel.playsLike': 1, 'feel.lowSample': 1, 'feel.source': 1, 'feel.working.dc': 1, 'feel.working.perConstant': 1, 'feel.maishift.dc': 1, 'feel.maishift.bands.perConstant': 1, 'feel.maishift.bands.weight': 1 } },
  ).toArray();

  const summary = (list: Doc[], dcOf: (d: Doc) => number, sOf: (d: Doc) => number) => {
    const dcs = list.map(dcOf);
    const byLevel: Record<string, number[]> = {};
    for (const d of list) (byLevel[Math.floor(d.constant)] ??= []).push(sOf(d));
    return {
      charts: list.length,
      capped: dcs.filter((x) => Math.abs(x) > 0.5).length,
      moveMedian: quantile(dcs.map(Math.abs), 0.5),
      move90th: quantile(dcs.map(Math.abs), 0.9),
      perConstantByLevel: Object.fromEntries(Object.entries(byLevel).map(([level, s]) => [level, { charts: s.length, median: quantile(s, 0.5), atFloor: s.filter((x) => x <= 0.3).length }])),
    };
  };
  const site = docs.filter((d) => d.feel.source !== 'maishift' && d.feel.working);
  const maishift = docs.filter((d) => d.feel.source === 'maishift' && d.feel.maishift);
  const unsure = await client.db('maimai').collection('chart_feel').countDocuments({ 'feel.unsure': true });
  return NextResponse.json({
    withPlaysLike: docs.length,
    unsure, // worked out, but not sure enough to show (sigma above SIGMA_MAX)
    site: summary(site, (d) => d.feel.working!.dc, (d) => d.feel.working!.perConstant),
    siteTrusted: summary(site.filter((d) => !d.feel.lowSample), (d) => d.feel.working!.dc, (d) => d.feel.working!.perConstant),
    maishift: summary(maishift, (d) => d.feel.maishift!.dc, (d) => d.feel.maishift!.bands.reduce((t, b) => t + b.perConstant * b.weight, 0)),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
