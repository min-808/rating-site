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
  fetchLivePlayer, VerifyBusyError, getClaimToken, setClaimCookie,
} from '../../../../lib/auth';

const VERIFY_MINUTES = 10; // time to change the title and press Verify
const LOCK_MINUTES = 15; // other browsers can't start a claim on this profile until then
const SETUP_MINUTES = 15; // after verifying, time to pick a username and password

const fail = (status: number, error: string, extra: object = {}) =>
  NextResponse.json({ error, ...extra }, { status });

export async function POST(req: Request) {
  const ip = clientIp(req);
  const body = (await req.json().catch(() => ({}))) as { webId?: unknown; captchaToken?: unknown };
  const webId = Number(body.webId);
  if (!Number.isInteger(webId)) return fail(400, 'Missing profile.');

  await ensureIndexes();
  const db = await getDb();
  const player = await db.collection('players').findOne({ web_id: webId }, { projection: { user_id: 1 } });
  if (!player) return fail(404, "That profile doesn't exist.");
  const userId = String(player.user_id);

  const claims = db.collection<ClaimDoc>('claims');
  const now = new Date();

  // a browser restarting its own claim is fine; anyone else waits out the lock
  const ownToken = await getClaimToken();
  const ownId = ownToken ? sha256(ownToken) : null;
  const blocking = await claims.findOne({
    user_id: userId,
    locked_until: { $gt: now },
    ...(ownId ? { _id: { $ne: ownId } } : {}),
  });
  if (blocking) {
    const minutes = Math.ceil((blocking.locked_until.getTime() - now.getTime()) / 60_000);
    return fail(409, `Someone is verifying this profile right now. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  const limit = await rateLimit(`claim-start:${ip}`, 5, 60 * 60_000);
  if (!limit.ok) return fail(429, 'Too many claims from here. Try again later.', { retryAfter: limit.retryAfterSec });

  if (!(await verifyCaptcha(body.captchaToken, ip))) return fail(400, 'The captcha check failed. Please try again.');

  // the starting point is what's on their profile RIGHT NOW, not last night's scrape,
  // so a title they changed earlier today can't count as proof
  let live;
  try {
    live = await fetchLivePlayer(userId);
  } catch (error) {
    if (error instanceof VerifyBusyError) return fail(503, 'Verification is busy. Try again in a minute.');
    return fail(503, "Couldn't reach maimai NET right now. Try again in a bit.");
  }
  if (!live.found) return fail(409, "This player isn't on our friends list right now, so they can't be verified.");

  if (ownId) await claims.deleteOne({ _id: ownId });

  const token = randomToken();
  const verifyUntil = new Date(now.getTime() + VERIFY_MINUTES * 60_000);
  const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000);
  await claims.insertOne({
    _id: sha256(token),
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
