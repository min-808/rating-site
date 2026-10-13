/**
 * POST /api/account/password   { current, password }
 *
 * Changes the signed-in player's password, from the settings page: the current one has
 * to be right, the new one follows the usual rules (checkPassword). Afterwards every
 * other browser is signed out; this one stays signed in. (The "type it twice" check is
 * the page's: this only ever gets the new password once.)
 */
import { NextResponse } from 'next/server';
import {
  type AccountDoc, getDb, getSession, checkPassword, hashPassword, verifyPassword, rateLimit, destroyOtherSessions,
} from '../../../../lib/auth';
import { logActivity } from '../../../../lib/activity';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail(401, 'sign in to change this');

  const body = (await req.json().catch(() => ({}))) as { current?: unknown; password?: unknown };
  const current = String(body.current ?? '');
  const password = String(body.password ?? '');

  // guessing the current password through here: the same few tries as signing in
  const limit = await rateLimit(`password-change:${session.userId}`, 5, 15 * 60_000);
  if (!limit.ok) return fail(429, 'too many tries. wait a few minutes and try again');

  const db = await getDb();
  const accounts = db.collection<AccountDoc>('accounts');
  const account = await accounts.findOne({ _id: session.userId }, { projection: { password_hash: 1 } });
  if (!account) return fail(404, 'no account');
  if (!(await verifyPassword(current, account.password_hash))) return fail(400, 'your current password is wrong');

  const problem = checkPassword(password);
  if (problem) return fail(400, problem);
  if (password === current) return fail(400, "that's the password you already have");

  await accounts.updateOne({ _id: session.userId }, { $set: { password_hash: await hashPassword(password), updated_at: new Date() } });
  await destroyOtherSessions(session.userId);
  await logActivity(req, session, 'password');
  return NextResponse.json({ ok: true });
}
