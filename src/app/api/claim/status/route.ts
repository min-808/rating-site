/**
 * GET /api/claim/status
 *
 * Whether a claim could start right now, so the panel can say so before the
 * visitor solves a captcha. start still checks everything again for real.
 *
 *   { open: true }
 *   { open: false, reason: 'closed', from, until }   closed hours (ISO times)
 *   { open: false, reason: 'busy', until }           someone else has the slot
 */
import { NextResponse } from 'next/server';
import { sha256, getClaimToken } from '../../../../lib/auth';
import { VERIFY_MINUTES, closedWindowDuring, slotBusyUntil } from '../../../../lib/claim-gate';

export const dynamic = 'force-dynamic';

const reply = (body: object) => NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const now = new Date();
  const closed = closedWindowDuring(now, new Date(now.getTime() + VERIFY_MINUTES * 60_000));
  if (closed) {
    return reply({ open: false, reason: 'closed', from: closed.from.toISOString(), until: closed.until.toISOString() });
  }

  const token = await getClaimToken();
  const busyUntil = await slotBusyUntil(token ? sha256(token) : null);
  if (busyUntil) return reply({ open: false, reason: 'busy', until: busyUntil.toISOString() });

  return reply({ open: true });
}