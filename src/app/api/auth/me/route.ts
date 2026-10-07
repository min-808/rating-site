/**
 * GET /api/auth/me  ->  { signedIn: false }  or  { signedIn: true, username, webId, isAdmin }
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
  const player = await db.collection('players').findOne({ user_id: session.userId }, { projection: { web_id: 1 } });
  return NextResponse.json(
    {
      signedIn: true,
      username: session.username,
      webId: player?.web_id ?? null,
      // only shows or hides the header's admin link. /admin checks for itself
      isAdmin: adminIds().includes(session.userId),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}