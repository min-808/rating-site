import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
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

  const friends = await db.collection('players').find({}).sort({ currentRank: 1 }).toArray();

  const targetIds = ["9051086240520", "101049398794479", "101281537035847", "102710053188031"];
  const filteredPlayers = friends.filter(
    (player) => !targetIds.includes(player.user_id)
  );

  // Overwrite snapshot collection with current filtered players
  await db.collection('daily_leaderboard').deleteMany({});
  if (filteredPlayers.length > 0) {
    await db.collection('daily_leaderboard').insertMany(filteredPlayers);
  }

  // NEW: Save the exact timestamp of this update to the database
  /*
  await db.collection('metadata').updateOne(
    { _id: 'leaderboard_update' },
    { $set: { lastUpdated: new Date() } },
    { upsert: true }
  );
  */

  // Purge static page cache so Next.js regenerates page.tsx on next visit
  revalidatePath('/');

  return NextResponse.json({ success: true, count: filteredPlayers.length });
}