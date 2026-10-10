/**
 * POST /api/claim/start   { webId, captchaToken }
 *
 * Starts a claim on a profile: checks the captcha and limits, reads the player's
 * title and icon live from maimai NET, and remembers them as the starting point.
 * The browser gets a claim cookie; only that browser can verify this claim.
 */
import { NextResponse } from 'next/server';
import {
  type ClaimDoc, getDb, ensureIndexes, randomToken, sha256, rateLimit, peekRateLimit, clientIp, verifyCaptcha,
  fetchLivePlayer, VerifyBusyError, VerifyNotConfiguredError, getClaimToken, setClaimCookie,
  getSession,
} from '../../../../lib/auth';
import {
  VERIFY_MINUTES, closedWindowDuring, closedMessage, takeSlot, releaseSlot, slotHeldBy, busyMessage, slotFreeAt,
  type LockDoc,
} from '../../../../lib/claim-gate';
import { logged } from '../../../../lib/attempts';

const LOCK_MINUTES = 15; // other browsers can't start a claim on this profile until then

// how often claims can start, all counted only once the captcha has passed. every start
// is a real maimai NET login, so these mostly protect the CLAL cookie from a flood of them
const LIMITS = {
  gapMinutes: 2, // between two starts from one ip (start, cancel, start again)
  perIp: { count: 5, minutes: 60 },
  perProfile: { count: 3, minutes: 60 }, // whoever is trying, from wherever
  siteWide: { count: 20, minutes: 60 }, // everyone together
};

const inTime = (sec: number) => {
  const minutes = Math.max(1, Math.ceil(sec / 60));
  return sec < 60 ? `${Math.max(1, sec)} second${sec === 1 ? '' : 's'}` : `${minutes} minute${minutes === 1 ? '' : 's'}`;
};
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

  // the backstop around each VPS job's cron time. a job that's already running holds the
  // slot instead (checked below), and a job that starts mid-claim waits for the claim
  const closed = closedWindowDuring(now);
  if (closed) return fail(503, closedMessage(closed), { closedUntil: closed.until.toISOString() });

  // "the slot is taken": who has it and when it should free up, for the panel
  const busy = (lock: LockDoc) =>
    fail(409, busyMessage(lock, now), { busyUntil: slotFreeAt(lock)?.toISOString() ?? null });

  // a browser restarting its own claim is fine; anyone else waits out the lock
  const ownToken = await getClaimToken();
  const ownId = ownToken ? sha256(ownToken) : null;

  // quick check before the rate limit and captcha, so waiting on someone else
  // doesn't use up this visitor's tries. takeSlot below is the real, race-proof check
  const taken = await slotHeldBy(ownId);
  if (taken) return busy(taken);

  const blocking = await claims.findOne({
    user_id: userId,
    locked_until: { $gt: now },
    ...(ownId ? { _id: { $ne: ownId } } : {}),
  });
  if (blocking) {
    const minutes = Math.ceil((blocking.locked_until.getTime() - now.getTime()) / 60_000);
    return fail(409, `someone is verifying this profile right now. try again in ${minutes} minute${minutes === 1 ? '' : 's'}`);
  }

  // the captcha first, so a failed one doesn't use up any of the limits below
  if (!(await verifyCaptcha(body.captchaToken, ip))) return fail(400, 'the captcha check failed. please try again');

  // the limits: all checked before any is counted, so being refused by one doesn't
  // use up the others. the 2-minute gap is a limit of 1 per 2 minutes
  const limits = [
    { key: `claim-gap:${ip}`, count: 1, minutes: LIMITS.gapMinutes,
      message: (s: number) => `you just started a claim. wait ${inTime(s)} before starting another` },
    { key: `claim-start:${ip}`, count: LIMITS.perIp.count, minutes: LIMITS.perIp.minutes,
      message: (s: number) => `too many claims from here. try again in ${inTime(s)}` },
    { key: `claim-profile:${userId}`, count: LIMITS.perProfile.count, minutes: LIMITS.perProfile.minutes,
      message: (s: number) => `this profile has had too many claims recently. try again in ${inTime(s)}` },
    { key: 'claim-site', count: LIMITS.siteWide.count, minutes: LIMITS.siteWide.minutes,
      message: (s: number) => `lots of people are claiming right now. try again in ${inTime(s)}` },
  ];
  for (const l of limits) {
    const peek = await peekRateLimit(l.key, l.count);
    if (!peek.ok) return fail(429, l.message(peek.retryAfterSec), { retryAfter: peek.retryAfterSec });
  }
  await Promise.all(limits.map((l) => rateLimit(l.key, l.count, l.minutes * 60_000)));

  // one claim at a time across the whole site: take the slot before touching maimai NET.
  // this browser's own earlier claim counts as "mine", so restarting works
  const token = randomToken();
  const claimId = sha256(token);
  const holder = await takeSlot(claimId, verifyUntil, [ownId]);
  if (holder) return busy(holder);

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
    return fail(503, "couldn't reach the maimai site right now. try again in a bit");
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