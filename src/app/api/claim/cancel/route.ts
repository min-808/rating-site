/**
 * POST /api/claim/cancel
 *
 * Throws away this browser's claim and gives the one-at-a-time slot back,
 * so the next person doesn't have to wait out a claim nobody's finishing.
 */
import { NextResponse } from 'next/server';
import { type ClaimDoc, getDb, sha256, getClaimToken, clearClaimCookie } from '../../../../lib/auth';
import { releaseSlot } from '../../../../lib/claim-gate';
import { logged } from '../../../../lib/attempts';

async function handle() {
  const token = await getClaimToken();
  if (token) {
    const id = sha256(token);
    const db = await getDb();
    await Promise.all([db.collection<ClaimDoc>('claims').deleteOne({ _id: id }), releaseSlot(id)]);
    await clearClaimCookie();
  }
  return NextResponse.json({ ok: true });
}

// every call is recorded in auth_attempts for the admin page (lib/attempts.ts)
export const POST = logged('claim-cancel', handle);