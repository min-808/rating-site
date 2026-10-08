/**
 * GET /api/claim/status
 *
 * Whether a claim could start right now, so the panel can say so before the
 * visitor solves a captcha. start still checks everything again for real.
 *
 *   { open: true }
 *   { open: false, reason: 'closed', message, from, until }   the backstop before a VPS job (ISO times)
 *   { open: false, reason: 'busy', message, until }           someone else has the slot: a claim, or a
 *                                                             VPS job (until: its estimate, or null)
 */
import { NextResponse } from 'next/server';
import { sha256, getClaimToken } from '../../../../lib/auth';
import { closedWindowDuring, closedMessage, slotHeldBy, busyMessage, slotFreeAt } from '../../../../lib/claim-gate';

export const dynamic = 'force-dynamic';

const reply = (body: object) => NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const now = new Date();
  const closed = closedWindowDuring(now);
  if (closed) {
    return reply({
      open: false, reason: 'closed', message: closedMessage(closed),
      from: closed.from.toISOString(), until: closed.until.toISOString(),
    });
  }

  const token = await getClaimToken();
  const taken = await slotHeldBy(token ? sha256(token) : null);
  if (taken) {
    return reply({ open: false, reason: 'busy', message: busyMessage(taken, now), until: slotFreeAt(taken)?.toISOString() ?? null });
  }

  return reply({ open: true });
}