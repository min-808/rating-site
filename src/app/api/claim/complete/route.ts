/**
 * POST /api/claim/complete   { username, password }
 *
 * After a verified claim: creates the account (or, on a reclaim, replaces the
 * password and signs every other browser out), then signs this browser in.
 */
import { NextResponse } from 'next/server';
import {
  type AccountDoc, type ClaimDoc, getDb, ensureIndexes, sha256, getClaimToken, clearClaimCookie,
  hashPassword, checkUsername, checkPassword, createSession, destroyAllSessions,
  getSession,
} from '../../../../lib/auth';
import { logged } from '../../../../lib/attempts';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

async function handle(req: Request) {
  // one account per person: a signed-in browser already has its profile and can't claim another
  if (await getSession()) return fail(403, "you're already signed in. sign out first if this isn't your account");
  const token = await getClaimToken();
  if (!token) return fail(400, 'no claim in progress. start again from the profile');

  await ensureIndexes();
  const db = await getDb();
  const claims = db.collection<ClaimDoc>('claims');
  const claim = await claims.findOne({ _id: sha256(token) });
  if (!claim?.verified_at || !claim.setup_until || new Date() > claim.setup_until) {
    return fail(410, 'this claim has expired. start again');
  }

  const body = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  const problem = checkUsername(username) ?? checkPassword(password);
  if (problem) return fail(400, problem);

  const accounts = db.collection<AccountDoc>('accounts');
  const usernameLower = username.toLowerCase();
  const taken = await accounts.findOne({ username_lower: usernameLower, _id: { $ne: claim.user_id } });
  if (taken) return fail(409, 'that username is taken');

  const now = new Date();
  try {
    await accounts.updateOne(
      { _id: claim.user_id },
      {
        $set: { username, username_lower: usernameLower, password_hash: await hashPassword(password), updated_at: now },
        $setOnInsert: { created_at: now },
      },
      { upsert: true },
    );
  } catch (error) {
    // two people grabbing the same username at the same moment
    if ((error as { code?: number }).code === 11000) return fail(409, 'that username is taken');
    throw error;
  }

  // a reclaim means whoever had access before shouldn't keep it
  await destroyAllSessions(claim.user_id);
  await claims.deleteOne({ _id: claim._id });
  await clearClaimCookie();
  await createSession(claim.user_id);

  return NextResponse.json({ ok: true, webId: claim.web_id });
}

// every call is recorded in auth_attempts for the admin page (lib/attempts.ts)
export const POST = logged('claim-complete', handle);