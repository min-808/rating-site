import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { connectMongo } from '../../../../lib/connect-db';
import { getCatalog } from '../../../../lib/song-catalog';
import { chartFeelId } from '../../../../lib/chart-feel-store';
import { buildFarmPicks, type FarmFeel } from '../../../../lib/farm-picks';
import { maishiftData, maishiftFeel, maishiftKey, type MaishiftChartsDoc, type MaishiftLevelDoc } from '../../../../lib/maishift-feel';
import type { ChartFeel } from '../../../../lib/plays-like';
import type { Song } from '../../../../lib/leaderboard';

/**
 * GET /api/recommend/farm-sample   development only: the rating-farm picks (lib/farm-picks.ts)
 * for one random player near each of 12,000, 13,000, 14,000 and 15,000 rating, for the mock.
 * No names or ids go out: each player is only their rating. ?near=500 sets how close.
 * Plays like is worked out fresh from maishift's data with the current method (nothing is
 * written), falling back to the saved result for charts maishift doesn't have.
 * ?save=1 also writes the result to .tmp-preview/farm-sample.json (for the mock page).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'development only' }, { status: 404 });
  try {
    const near = Number(new URL(request.url).searchParams.get('near')) || 500;
    const seed = Number(new URL(request.url).searchParams.get('seed')) || 1;
    const db = (await connectMongo()).db('maimai');
    const [catalog, feelDocs, maishiftDocs] = await Promise.all([
      getCatalog(),
      db.collection<{ _id: string; feel: ChartFeel }>('chart_feel').find({ 'feel.playsLike': { $ne: null } },
        { projection: { 'feel.playsLike': 1, 'feel.playsLikeLow': 1, 'feel.playsLikeHigh': 1, 'feel.unsure': 1 } }).toArray(),
      db.collection<MaishiftLevelDoc | MaishiftChartsDoc>('maishift_levels').find({} as object).toArray(),
    ]);
    void feelDocs;
    const feels = new Map<string, FarmFeel>();
    const maishift = maishiftData(maishiftDocs as Array<MaishiftLevelDoc | MaishiftChartsDoc>);
    let fresh = 0;
    if (maishift) {
      for (const song of catalog) {
        for (const chart of song.charts) {
          const id = song.titles.map((t) => maishift.byChart.get(maishiftKey(t, chart.kind, chart.difficulty))).find((x) => x != null);
          if (id == null) continue;
          const feel = maishiftFeel(chart.internal, song.versionCode, id, maishift);
          if (!feel || feel.playsLike == null) continue;
          const bands = feel.maishift?.bands ?? [];
          const top = bands.reduce<(typeof bands)[number] | null>((best, b) => (!best || b.weight > best.weight ? b : best), null);
          feels.set(chartFeelId(song.id, chart), {
            playsLike: feel.playsLike, low: feel.playsLikeLow ?? null, high: feel.playsLikeHigh ?? null, unsure: !!feel.unsure, players: feel.counted, buckets: bands.length,
            top: top && { from: top.from, to: top.to, players: top.players, middle: top.adjusted, typical: top.typicalScore, weight: top.weight },
          });
          fresh += 1;
        }
      }
    }
    const out = [];
    for (const target of [12000, 13000, 14000, 15000]) {
      // the same player every time for the same ?seed (no ids leave the server)
      const [{ n } = { n: 0 }] = await db.collection('players').aggregate([
        { $match: { scores_opt_out: { $ne: true }, rating: { $gte: target - near, $lt: target + near } } }, { $count: 'n' },
      ]).toArray() as Array<{ n: number }>;
      const [player] = n === 0 ? [] : await db.collection('players').aggregate([
        { $match: { scores_opt_out: { $ne: true }, rating: { $gte: target - near, $lt: target + near } } },
        { $sort: { web_id: 1 } },
        { $skip: (seed * 7919 + target) % n },
        { $limit: 1 },
        { $project: { _id: 0, rating: 1, 'songs.title': 1, 'songs.genre': 1, 'songs.kind': 1, 'songs.difficulty': 1, 'songs.internal_difficulty': 1, 'songs.achievement': 1, 'songs.new_pool': 1, 'songs.ap': 1 } },
      ]).toArray();
      if (!player) { out.push({ target, player: null }); continue; }
      const picks = buildFarmPicks((player.songs ?? []) as Song[], catalog, feels, chartFeelId);
      out.push({ target, player: { rating: Number(player.rating), ...picks } });
    }
    const body = { feels: feels.size, fresh, samples: out };
    if (new URL(request.url).searchParams.get('save')) {
      await mkdir('.tmp-preview', { recursive: true });
      await writeFile('.tmp-preview/farm-sample.json', JSON.stringify(body));
    }
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json({ error: String((error as Error)?.message ?? error).slice(0, 300) }, { status: 500 });
  }
}
