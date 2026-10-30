/**
 * GET /api/profile/my-charts  ->  { signedIn: false }
 *                             or  { signedIn: true, hasScores: false }
 *                             or  { signedIn: true, hasScores: true, played, recommended, floors }
 *
 * The signed-in player's charts, for the charts page's played / unplayed and "recommended"
 * filters (components/SongBrowser.tsx). Per song id, a bit per chart (lib/song-browse.ts,
 * chartBit):
 *   played:      charts they have a score on
 *   recommended: charts an SSS+ would raise their rating on (new ones for their best 50,
 *                or ones in it below SSS+), the few that players at their rating SSS+
 *                most often (lib/my-charts.ts). From maishift's
 *                stats (lib/recommend.ts): empty under 13000, and until the scraper has saved them
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
import { bandStatsFor } from '../../../../lib/recommend';

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

  const band = await bandStatsFor(Number(player?.rating) || 0);
  const { played, recommended, floors } = buildMyCharts(scores, await getCatalog(), band);

  return NextResponse.json({ signedIn: true, hasScores: true, played, recommended, floors }, { headers: PRIVATE });
}
