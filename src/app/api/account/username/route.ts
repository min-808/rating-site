/**
 * POST /api/account/username   { username }
 *
 * Changes the signed-in player's username, from the settings page. Once every
 * USERNAME_CHANGE_DAYS (the username picked when claiming doesn't count). The old one is
 * kept in past_usernames, with when it stopped being theirs. Same rules as when claiming
 * (checkUsername), and it can't be someone else's current username.
 */
import { NextResponse } from 'next/server';
import { type AccountDoc, getDb, getSession, ensureIndexes, checkUsername, rateLimit } from '../../../../lib/auth';
import { nextUsernameChange, USERNAME_CHANGE_DAYS } from '../../../../lib/account-settings';
import { logActivity } from '../../../../lib/activity';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail(401, 'sign in to change this');

  const body = (await req.json().catch(() => ({}))) as { username?: unknown };
  const username = String(body.username ?? '').trim();
  const problem = checkUsername(username);
  if (problem) return fail(400, problem);

  // stops a script trying names over and over to find free ones
  const limit = await rateLimit(`username:${session.userId}`, 20, 60 * 60_000);
  if (!limit.ok) return fail(429, "you've tried a lot of names recently. try again in a bit");

  await ensureIndexes();
  const db = await getDb();
  const accounts = db.collection<AccountDoc>('accounts');
  const account = await accounts.findOne({ _id: session.userId }, { projection: { username: 1, username_changed_at: 1 } });
  if (!account) return fail(404, 'no account');
  if (username === account.username) return fail(400, "that's already your username");

  const next = nextUsernameChange(account.username_changed_at);
  if (next) {
    return fail(429, `usernames can be changed once every ${USERNAME_CHANGE_DAYS} days. next change: ${next.toISOString()}`);
  }

  const usernameLower = username.toLowerCase();
  const taken = await accounts.findOne({ username_lower: usernameLower, _id: { $ne: session.userId } }, { projection: { _id: 1 } });
  if (taken) return fail(409, 'that username is taken');

  const now = new Date();
  try {
    await accounts.updateOne(
      { _id: session.userId },
      {
        $set: { username, username_lower: usernameLower, username_changed_at: now, updated_at: now },
        $push: { past_usernames: { username: account.username, until: now } },
      },
    );
  } catch (error) {
    // someone else took it at the same moment
    if ((error as { code?: number }).code === 11000) return fail(409, 'that username is taken');
    throw error;
  }

  await logActivity(req, session, 'username', { before: account.username, after: username });
  return NextResponse.json({ username, changedAt: now.toISOString() });
}
