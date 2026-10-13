/**
 * GET /api/auth/me  ->  { signedIn: false }  or  { signedIn: true, username, webId, icon, iconFallback, isAdmin }
 *
 * Lets the header's account button check who's signed in from the browser, so
 * the layout doesn't have to read cookies (which would make every page render
 * per visitor and switch off the leaderboard's caching).
 */
import { NextResponse } from 'next/server';
import { getSession, getDb } from '../../../../lib/auth';
import { adminIds } from '../../../../lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ signedIn: false }, { headers: { 'Cache-Control': 'no-store' } });

  const db = await getDb();
  // players.user_id may be stored as text or as a number
  const player = await db
    .collection('players')
    .findOne({ user_id: { $in: [session.userId, Number(session.userId)] } }, { projection: { web_id: 1, pfp: 1, pfp_blob: 1 } });
  return NextResponse.json(
    {
      signedIn: true,
      username: session.username,
      webId: player?.web_id ?? null,
      // their in-game icon for the header: our blob copy first, maimai's own url if that fails
      icon: player?.pfp_blob ?? null,
      iconFallback: player?.pfp ?? null,
      // only shows or hides the header's admin link. /admin checks for itself
      isAdmin: adminIds().includes(session.userId),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}