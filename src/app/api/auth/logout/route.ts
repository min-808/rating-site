/**
 * POST /api/auth/logout
 */
import { NextResponse } from 'next/server';
import { destroySession, getSession } from '../../../../lib/auth';
import { logActivity } from '../../../../lib/activity';

export async function POST(req: Request) {
  // who it was, read before the session is gone, for the admin page's activity log
  const session = await getSession();
  await destroySession();
  if (session) await logActivity(req, session, 'sign-out');
  return NextResponse.json({ ok: true });
}
