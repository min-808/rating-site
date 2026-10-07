/**
 * POST /api/claim/start   { webId, captchaToken }
 *
 * Starts a claim on a profile: checks the captcha and limits, reads the player's
 * title and icon live from maimai NET, and remembers them as the starting point.
 * The browser gets a claim cookie; only that browser can verify this claim.
 */
import { NextResponse } from 'next/server';
import {
  type ClaimDoc, getDb, ensureIndexes, randomToken, sha256, rateLimit, clientIp, verifyCaptcha,
  fetchLivePlayer, VerifyBusyError, VerifyNotConfiguredError, getClaimToken, setClaimCookie,
  getSession,
} from '../../../../lib/auth';
import {
  VERIFY_MINUTES, closedWindowDuring, closedMessage, takeSlot, releaseSlot, slotBusyUntil, busyMessage,
} from '../../../../lib/claim-gate';
import { logged } from '../../../../lib/attempts';

const LOCK_MINUTES = 15; // other browsers can't start a claim on this profile until then
const SETUP_MINUTES = 15; // after verifying, time to pick a username and password

const fail = (status: number, error: string, extra: object = {}) =>
  NextResponse.json({ error, ...extra }, { status });

async function handle(req: Request) {
  // one account per person: a signed-in browser already has its profile and can't claim another
  if (await getSession()) return fail(403, "you're already signed in. sign out first if this isn't your account");
  const ip = clientIp(req);
  const body = (await req.json().catch(() => ({}))) as { webId?: unknown; captchaToken?: unknown };
  const webId = Number(body.webId);
  if (!Number.isInteger(webId)) return fail(400, 'missing profile');

  await ensureIndexes();
  const db = await getDb();
  const player = await db.collection('players').findOne({ web_id: webId }, { projection: { user_id: 1 } });
  if (!player) return fail(404, "that profile doesn't exist");
  const userId = String(player.user_id);

  const claims = db.collection<ClaimDoc>('claims');
  const now = new Date();
  const verifyUntil = new Date(now.getTime() + VERIFY_MINUTES * 60_000);

  // closed hours: the scrapers have maimai NET. the whole verify window has to fit
  // before the next pause, or the last verify presses would land in it
  const closed = closedWindowDuring(now, verifyUntil);
  if (closed) return fail(503, closedMessage(closed, now), { closedUntil: closed.until.toISOString() });

  // a browser restarting its own claim is fine; anyone else waits out the lock
  const ownToken = await getClaimToken();
  const ownId = ownToken ? sha256(ownToken) : null;

  // quick check before the rate limit and captcha, so waiting on someone else
  // doesn't use up this visitor's tries. takeSlot below is the real, race-proof check
  const slotTakenUntil = await slotBusyUntil(ownId);
  if (slotTakenUntil) return fail(409, busyMessage(slotTakenUntil, now), { busyUntil: slotTakenUntil.toISOString() });

  const blocking = await claims.findOne({
    user_id: userId,
    locked_until: { $gt: now },
    ...(ownId ? { _id: { $ne: ownId } } : {}),
  });
  if (blocking) {
    const minutes = Math.ceil((blocking.locked_until.getTime() - now.getTime()) / 60_000);
    return fail(409, `someone is verifying this profile right now. try again in ${minutes} minute${minutes === 1 ? '' : 's'}`);
  }

  const limit = await rateLimit(`claim-start:${ip}`, 5, 60 * 60_000);
  if (!limit.ok) return fail(429, 'too many claims from here. try again later', { retryAfter: limit.retryAfterSec });

  if (!(await verifyCaptcha(body.captchaToken, ip))) return fail(400, 'the captcha check failed. please try again');

  // one claim at a time across the whole site: take the slot before touching maimai NET.
  // this browser's own earlier claim counts as "mine", so restarting works
  const token = randomToken();
  const claimId = sha256(token);
  const busyUntil = await takeSlot(claimId, verifyUntil, [ownId]);
  if (busyUntil) return fail(409, busyMessage(busyUntil, now), { busyUntil: busyUntil.toISOString() });

  // the starting point is what's on their profile RIGHT NOW, not last night's scrape,
  // so a title they changed earlier today can't count as proof
  let live;
  try {
    live = await fetchLivePlayer(userId);
  } catch (error) {
    await releaseSlot(claimId);
    if (error instanceof VerifyBusyError) return fail(503, 'verification is busy. try again in a minute');
    // the real reason goes to Vercel's function logs
    console.error('[claim/start] verify server lookup failed:', error);
    if (error instanceof VerifyNotConfiguredError) return fail(500, error.message);
    return fail(503, "couldn't reach maimai NET right now. try again in a bit");
  }
  if (!live.found) {
    await releaseSlot(claimId);
    return fail(409, "this player isn't on our friends list right now, so they can't be verified");
  }

  if (ownId) await claims.deleteOne({ _id: ownId });

  const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000);
  await claims.insertOne({
    _id: claimId,
    user_id: userId,
    web_id: webId,
    baseline_title: live.title ?? null,
    baseline_icon: live.icon ?? null,
    started_at: now,
    verify_until: verifyUntil,
    locked_until: lockedUntil,
    checks: 0,
    last_check_at: null,
    verified_at: null,
    setup_until: null,
    // kept a little past everything else, then MongoDB deletes it
    delete_at: new Date(now.getTime() + (LOCK_MINUTES + SETUP_MINUTES + 5) * 60_000),
  });
  await setClaimCookie(token);

  return NextResponse.json({ verifyUntil: verifyUntil.toISOString(), currentTitle: live.title ?? null });
}

// every call is recorded in auth_attempts for the admin page (lib/attempts.ts)
export const POST = logged('claim-start', handle);