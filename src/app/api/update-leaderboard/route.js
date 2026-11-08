import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { clearSongDataCache } from '../../../lib/song-data';
import { clearAllPlayersCache } from '../../../lib/player-data';
import { connectMongo } from '../../../lib/connect-db';
import { refreshChartFeels } from '../../../lib/chart-feel-store';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await connectMongo();
  const db = client.db('maimai');

  await db.collection('metadata').updateOne(
    { _id: 'leaderboard_update' },
    { $set: { lastUpdated: new Date() } },
    { upsert: true }
  );

  revalidatePath('/');
  revalidatePath('/charts'); // shows the same "last updated"
  // the song data profiles and the level summary keep cached (lib/song-data.ts), so a
  // song import shows up by the next morning
  clearSongDataCache();
  // and every player's cached record (lib/player-data.ts), so the night's scores show
  clearAllPlayersCache();

  // the night's new scores: work "plays like" out again for the levels they changed
  // (lib/chart-feel-store.ts). a failure here mustn't fail the night's update
  let chartFeel = null;
  try {
    chartFeel = await refreshChartFeels();
  } catch (error) {
    console.error('chart feel refresh failed', error);
  }

  return NextResponse.json({ success: true, chartFeel });
}