/**
 * Accounts, sessions and the shared helpers the claim + login routes use.
 * Server-only: import this from route handlers and server components, never
 * from a 'use client' file.
 *
 * Collections (all in the "maimai" db):
 *   accounts     { _id: user_id, username, username_lower, password_hash, created_at, updated_at }
 *   sessions     { _id: sha256(token), user_id, created_at, expires_at }      expires_at is a TTL index
 *   claims       { _id: sha256(token), user_id, ... delete_at }               delete_at is a TTL index
 *   rate_limits  { _id: key, count, expires_at }                              expires_at is a TTL index
 *
 * Raw tokens only ever live in the visitor's cookie. The database stores their
 * sha256, so a leaked database can't be used to sign in as anyone.
 */
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { connectMongo, getMongoClient } from './connect-db';

export const SESSION_COOKIE = 'hm_session';
export const CLAIM_COOKIE = 'hm_claim';
const SESSION_DAYS = 30;

export type AccountDoc = {
  _id: string; // the player's user_id
  username: string;
  username_lower: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
};

export type SessionDoc = { _id: string; user_id: string; created_at: Date; expires_at: Date };

export type ClaimDoc = {
  _id: string; // sha256 of the token in the claim cookie
  user_id: string;
  web_id: number;
  baseline_title: string | null;
  baseline_icon: string | null;
  started_at: Date;
  verify_until: Date; // Verify works until this
  locked_until: Date; // other browsers can't claim this profile until this
  checks: number;
  last_check_at: Date | null;
  verified_at: Date | null;
  setup_until: Date | null; // set username / password until this
  delete_at: Date;
};

export type RateLimitDoc = { _id: string; count: number; expires_at: Date };

// ---------------------------------------------------------------------------
// database

export async function getDb() {
  await connectMongo();
  const client = await getMongoClient();
  return client.db('maimai');
}

let indexesReady: Promise<void> | null = null;

// creates the indexes once per server instance (cheap no-ops after the first time)
export function ensureIndexes() {
  indexesReady ??= (async () => {
    const db = await getDb();
    await Promise.all([
      db.collection('accounts').createIndex({ username_lower: 1 }, { unique: true }),
      db.collection('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
      db.collection('sessions').createIndex({ user_id: 1 }),
      db.collection('claims').createIndex({ delete_at: 1 }, { expireAfterSeconds: 0 }),
      db.collection('claims').createIndex({ user_id: 1 }),
      db.collection('rate_limits').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    ]).then(() => undefined);
  })().catch((error) => {
    indexesReady = null; // try again next request
    throw error;
  });
  return indexesReady;
}

// ---------------------------------------------------------------------------
// tokens and passwords

export const randomToken = () => crypto.randomBytes(32).toString('base64url');
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

// "scrypt$N$r$p$salt$hash", so the cost can be raised later without breaking old hashes
export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(saltB64, 'base64'), expected.length,
      { N: Number(N), r: Number(r), p: Number(p) }, (err, k) => (err ? reject(err) : resolve(k)));
  });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// ---------------------------------------------------------------------------
// usernames and passwords: the rules

export const USERNAME_RULES = '3 to 20 characters: letters, numbers, _ . or -';
export const PASSWORD_RULES = 'at least 8 characters';

export function checkUsername(username: string): string | null {
  if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username)) return `Usernames need ${USERNAME_RULES}.`;
  return null;
}

export function checkPassword(password: string): string | null {
  if (password.length < 8) return `Passwords need ${PASSWORD_RULES}.`;
  if (password.length > 200) return 'That password is too long.';
  return null;
}

// a starting suggestion from their in-game name; they can change it
export function suggestUsername(name: string, webId: number) {
  const ascii = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
  return ascii.length >= 3 ? ascii : `player${webId}`;
}

// ---------------------------------------------------------------------------
// sessions

const cookieOptions = (expires?: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  ...(expires ? { expires } : {}),
});

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await db.collection<SessionDoc>('sessions').insertOne({
    _id: sha256(token),
    user_id: userId,
    created_at: now,
    expires_at: expires,
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expires));
}

export type Session = { userId: string; username: string };

// who's signed in on this request, or null
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const session = await db
    .collection<SessionDoc>('sessions')
    .findOne({ _id: sha256(token), expires_at: { $gt: new Date() } });
  if (!session) return null;

  const account = await db
    .collection<AccountDoc>('accounts')
    .findOne({ _id: session.user_id }, { projection: { username: 1 } });
  if (!account) return null;

  return { userId: session.user_id, username: account.username };
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.collection<SessionDoc>('sessions').deleteOne({ _id: sha256(token) });
  }
  store.delete(SESSION_COOKIE);
}

// signs every browser out of an account (used when someone reclaims it)
export async function destroyAllSessions(userId: string) {
  const db = await getDb();
  await db.collection<SessionDoc>('sessions').deleteMany({ user_id: userId });
}

// ---------------------------------------------------------------------------
// claim cookie

export async function setClaimCookie(token: string) {
  (await cookies()).set(CLAIM_COOKIE, token, { ...cookieOptions(), maxAge: 60 * 60 });
}

export async function getClaimToken() {
  return (await cookies()).get(CLAIM_COOKIE)?.value ?? null;
}

export async function clearClaimCookie() {
  (await cookies()).delete(CLAIM_COOKIE);
}

// ---------------------------------------------------------------------------
// rate limits (in MongoDB, since each Vercel request may run on a different server)

/**
 * Counts one hit against `key`. The window starts on the first hit and resets
 * once it's over. Returns whether this hit is within the limit.
 */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const db = await getDb();
  const now = new Date();
  const fresh = new Date(now.getTime() + windowMs);

  // one atomic update: count up inside a live window, or start a new one
  const doc = await db.collection<RateLimitDoc>('rate_limits').findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          count: { $cond: [{ $gt: ['$expires_at', now] }, { $add: ['$count', 1] }, 1] },
          expires_at: { $cond: [{ $gt: ['$expires_at', now] }, '$expires_at', fresh] },
        },
      },
    ],
    { upsert: true, returnDocument: 'after' },
  );

  const count = doc?.count ?? 1;
  const resetAt = doc?.expires_at ?? fresh;
  return {
    ok: count <= limit,
    retryAfterSec: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  };
}

// the visitor's ip, as Vercel passes it along
export function clientIp(req: Request) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ---------------------------------------------------------------------------
// captcha (Cloudflare Turnstile). turned off when the secret isn't set, for local dev

export const captchaEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

export async function verifyCaptcha(token: unknown, ip: string) {
  if (!captchaEnabled()) return true;
  if (typeof token !== 'string' || !token) return false;

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, remoteip: ip }),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
  return Boolean(data?.success);
}

// ---------------------------------------------------------------------------
// the VPS verify server

export type LivePlayer = { found: boolean; name?: string | null; title?: string | null; icon?: string | null };

export class VerifyBusyError extends Error {}

// reads the player's title and icon from maimai NET right now, through the VPS
export async function fetchLivePlayer(userId: string): Promise<LivePlayer> {
  const base = process.env.VERIFY_URL;
  const token = process.env.VERIFY_TOKEN;
  if (!base || !token) throw new Error('Profile verification is not set up on this server.');

  const res = await fetch(`${base.replace(/\/$/, '')}/player/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  if (res.status === 429) throw new VerifyBusyError('Verification is busy right now.');
  if (!res.ok) throw new Error(`verify server answered ${res.status}`);
  return (await res.json()) as LivePlayer;
}

// did the title or icon change since the claim started?
export function profileChanged(baseline: { title: string | null; icon: string | null }, live: LivePlayer) {
  const norm = (v: string | null | undefined) => (v ?? '').normalize('NFKC').trim();
  return norm(live.title) !== norm(baseline.title) || norm(live.icon) !== norm(baseline.icon);
}
