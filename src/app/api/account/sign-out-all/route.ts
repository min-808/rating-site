/**
 * POST /api/account/sign-out-all
 *
 * Signs the player out everywhere, this browser included: every session on their account
 * goes, and this browser's cookie with it. From the settings page.
 */
import { NextResponse } from 'next/server';
import { getSession, destroyAllSessions, destroySession } from '../../../../lib/auth';
import { logActivity } from '../../../../lib/activity';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  await destroyAllSessions(session.userId);
  await destroySession(); // this browser's cookie (its session is already gone)
  await logActivity(req, session, 'sign-out-all');
  return NextResponse.json({ ok: true });
}
