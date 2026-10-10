/**
 * POST /api/claim/verify
 *
 * Re-reads the player's title and icon and compares them with when the claim
 * started. A change means this browser's visitor controls the maimai account.
 */
import { NextResponse } from 'next/server';
import {
  type AccountDoc, type ClaimDoc, getDb, sha256, getClaimToken, fetchLivePlayer, VerifyBusyError, VerifyNotConfiguredError,
  profileChanged,
  getSession,
} from '../../../../lib/auth';
import { releaseSlot } from '../../../../lib/claim-gate';
import { logged } from '../../../../lib/attempts';

const MIN_SECONDS_BETWEEN_CHECKS = 20;
const MAX_CHECKS = 6;
const SETUP_MINUTES = 15;

const fail = (status: number, error: string, extra: object = {}) =>
  NextResponse.json({ error, ...extra }, { status });

async function handle() {
  // one account per person: a signed-in browser already has its profile and can't claim another
  if (await getSession()) return fail(403, "you're already signed in. sign out first if this isn't your account");
  const token = await getClaimToken();
  if (!token) return fail(400, 'no claim in progress. start again from the profile');

  const db = await getDb();
  const claims = db.collection<ClaimDoc>('claims');
  const claim = await claims.findOne({ _id: sha256(token) });
  if (!claim) return fail(410, 'this claim has expired. start again');

  const now = new Date();
  if (!claim.verified_at) {
    if (now > claim.verify_until) return fail(410, 'time ran out. start the claim again');
    if (claim.checks >= MAX_CHECKS) return fail(429, 'too many checks. start the claim again');
    // no closed-hours check here: this claim holds the slot until its verify window ends,
    // and a VPS job that starts meanwhile waits for it, so maimai NET is ours until then
    if (claim.last_check_at) {
      const wait = MIN_SECONDS_BETWEEN_CHECKS - (now.getTime() - claim.last_check_at.getTime()) / 1000;
      if (wait > 0) return fail(429, `give it ${Math.ceil(wait)} more seconds before checking again`, { retryAfter: Math.ceil(wait) });
    }

    await claims.updateOne({ _id: claim._id }, { $inc: { checks: 1 }, $set: { last_check_at: now } });

    let live;
    try {
      live = await fetchLivePlayer(claim.user_id);
    } catch (error) {
      if (error instanceof VerifyBusyError) return fail(503, 'verification is busy. try again in a minute');
      // the real reason goes to Vercel's function logs
      console.error('[claim/verify] verify server lookup failed:', error);
      if (error instanceof VerifyNotConfiguredError) return fail(500, error.message);
      return fail(503, "couldn't reach the maimai site right now. try again in a bit");
    }

    if (!live.found || !profileChanged({ title: claim.baseline_title, icon: claim.baseline_icon }, live)) {
      // that was their last check: let the next person in now instead of when time runs out
      if (claim.checks + 1 >= MAX_CHECKS) await releaseSlot(claim._id);
      return NextResponse.json({
        verified: false,
        currentTitle: live.title ?? null,
        checksLeft: MAX_CHECKS - claim.checks - 1,
      });
    }

    await claims.updateOne(
      { _id: claim._id },
      { $set: { verified_at: now, setup_until: new Date(now.getTime() + SETUP_MINUTES * 60_000) } },
    );
    // done with maimai NET: picking a username and password doesn't need it
    await releaseSlot(claim._id);
  }

  // verified. a reclaim keeps its username, so the setup step fills that in; a new
  // account starts blank, so people pick their own instead of taking a suggestion
  const account = await db.collection<AccountDoc>('accounts').findOne({ _id: claim.user_id }, { projection: { username: 1 } });
  return NextResponse.json({
    verified: true,
    existingUsername: account?.username ?? null,
    suggestedUsername: account?.username ?? null,
  });
}

// every call is recorded in auth_attempts for the admin page (lib/attempts.ts)
export const POST = logged('claim-verify', handle);