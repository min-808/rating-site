import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { connectMongo, getMongoClient } from '../../../lib/connect-db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectMongo();
  const client = await getMongoClient();
  const db = client.db('maimai');

  await db.collection('metadata').updateOne(
    { _id: 'leaderboard_update' },
    { $set: { lastUpdated: new Date() } },
    { upsert: true }
  );

  revalidatePath('/');
  // the song data profiles and the level summary keep cached (lib/song-data.ts), so a
  // song import shows up by the next morning
  revalidateTag('song-data', 'max');
  // and every player's cached record (lib/player-data.ts), so the night's scores show
  revalidateTag('players', 'max');

  return NextResponse.json({ success: true });
}