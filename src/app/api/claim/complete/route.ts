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
} from '../../../../lib/auth';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const token = await getClaimToken();
  if (!token) return fail(400, 'No claim in progress. Start again from the profile.');

  await ensureIndexes();
  const db = await getDb();
  const claims = db.collection<ClaimDoc>('claims');
  const claim = await claims.findOne({ _id: sha256(token) });
  if (!claim?.verified_at || !claim.setup_until || new Date() > claim.setup_until) {
    return fail(410, 'This claim has expired. Start again.');
  }

  const body = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  const problem = checkUsername(username) ?? checkPassword(password);
  if (problem) return fail(400, problem);

  const accounts = db.collection<AccountDoc>('accounts');
  const usernameLower = username.toLowerCase();
  const taken = await accounts.findOne({ username_lower: usernameLower, _id: { $ne: claim.user_id } });
  if (taken) return fail(409, 'That username is taken.');

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
    if ((error as { code?: number }).code === 11000) return fail(409, 'That username is taken.');
    throw error;
  }

  // a reclaim means whoever had access before shouldn't keep it
  await destroyAllSessions(claim.user_id);
  await claims.deleteOne({ _id: claim._id });
  await clearClaimCookie();
  await createSession(claim.user_id);

  return NextResponse.json({ ok: true, webId: claim.web_id });
}
