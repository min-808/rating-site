/**
 * GET /api/profile/my-charts  ->  { signedIn: false }
 *                             or  { signedIn: true, hasScores: false }
 *                             or  { signedIn: true, hasScores: true, played, raise, floors }
 *
 * The signed-in player's charts, for the song list's played / unplayed and "could raise my
 * rating" filters (components/SongBrowser.tsx). played and raise are per song id, a bit
 * per chart (lib/song-browse.ts, chartBit):
 *   played: charts they have a score on
 *   raise:  charts not in their best 50 that would get in with an SSS+ (100.5%): rated
 *           above the floor of the half they'd count toward (B15 new songs, B35 old). With
 *           fewer than 15 / 35 charts there, any chart would
 *
 * Built from the player's cached record (lib/player-data.ts, the one their profile uses)
 * and the cached song list, so it costs one small read to find their record. The account
 * comes from the session, never from the request.
 */
import { NextResponse } from 'next/server';
import { getDb, getSession } from '../../../../lib/auth';
import { getPlayerByWebId } from '../../../../lib/player-data';
import { getCatalog } from '../../../../lib/song-catalog';
import { buildMyCharts } from '../../../../lib/my-charts';

export const dynamic = 'force-dynamic';

// their own data, so not shared; kept a few minutes so going back to the list doesn't ask again
const PRIVATE = { 'Cache-Control': 'private, max-age=300' };
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ signedIn: false }, { headers: NO_STORE });

  // players.user_id may be stored as text or as a number
  const db = await getDb();
  const found = await db.collection<{ web_id: number }>('players').findOne(
    { user_id: { $in: [session.userId, Number(session.userId)] } } as object,
    { projection: { _id: 0, web_id: 1 } },
  );
  const player = found ? await getPlayerByWebId(found.web_id) : null;
  const scores = (player?.songs ?? []).filter((s) => (s.achievement ?? 0) > 0);
  if (scores.length === 0) return NextResponse.json({ signedIn: true, hasScores: false }, { headers: PRIVATE });

  const { played, raise, floors } = buildMyCharts(scores, await getCatalog());

  return NextResponse.json({ signedIn: true, hasScores: true, played, raise, floors }, { headers: PRIVATE });
}
