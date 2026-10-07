/**
 * POST /api/claim/verify
 *
 * Re-reads the player's title and icon and compares them with when the claim
 * started. A change means this browser's visitor controls the maimai account.
 */
import { NextResponse } from 'next/server';
import {
  type AccountDoc, type ClaimDoc, getDb, sha256, getClaimToken, fetchLivePlayer, VerifyBusyError,
  profileChanged, suggestUsername,
} from '../../../../lib/auth';

const MIN_SECONDS_BETWEEN_CHECKS = 20;
const MAX_CHECKS = 6;
const SETUP_MINUTES = 15;

const fail = (status: number, error: string, extra: object = {}) =>
  NextResponse.json({ error, ...extra }, { status });

export async function POST() {
  const token = await getClaimToken();
  if (!token) return fail(400, 'No claim in progress. Start again from the profile.');

  const db = await getDb();
  const claims = db.collection<ClaimDoc>('claims');
  const claim = await claims.findOne({ _id: sha256(token) });
  if (!claim) return fail(410, 'This claim has expired. Start again.');

  const now = new Date();
  if (!claim.verified_at) {
    if (now > claim.verify_until) return fail(410, 'Time ran out. Start the claim again.');
    if (claim.checks >= MAX_CHECKS) return fail(429, 'Too many checks. Start the claim again.');
    if (claim.last_check_at) {
      const wait = MIN_SECONDS_BETWEEN_CHECKS - (now.getTime() - claim.last_check_at.getTime()) / 1000;
      if (wait > 0) return fail(429, `Give it ${Math.ceil(wait)} more seconds before checking again.`, { retryAfter: Math.ceil(wait) });
    }

    await claims.updateOne({ _id: claim._id }, { $inc: { checks: 1 }, $set: { last_check_at: now } });

    let live;
    try {
      live = await fetchLivePlayer(claim.user_id);
    } catch (error) {
      if (error instanceof VerifyBusyError) return fail(503, 'Verification is busy. Try again in a minute.');
      return fail(503, "Couldn't reach maimai NET right now. Try again in a bit.");
    }

    if (!live.found || !profileChanged({ title: claim.baseline_title, icon: claim.baseline_icon }, live)) {
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
  }

  // verified: suggest a username for the setup step (their old one, if this is a reclaim)
  const [account, player] = await Promise.all([
    db.collection<AccountDoc>('accounts').findOne({ _id: claim.user_id }, { projection: { username: 1 } }),
    db.collection('players').findOne({ user_id: claim.user_id }, { projection: { name: 1 } }),
  ]);
  return NextResponse.json({
    verified: true,
    existingUsername: account?.username ?? null,
    suggestedUsername: account?.username ?? suggestUsername(String(player?.name ?? ''), claim.web_id),
  });
}
