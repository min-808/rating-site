/**
 * POST /api/auth/login   { username, password }
 */
import { NextResponse } from 'next/server';
import { type AccountDoc, getDb, ensureIndexes, verifyPassword, createSession, hashPassword, rateLimit, clientIp } from '../../../../lib/auth';
import { logged } from '../../../../lib/attempts';

const WRONG = 'wrong username or password';

// checked against when the username doesn't exist, so both cases take as long
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('not-a-real-password'));

async function handle(req: Request) {
  const ip = clientIp(req);
  const body = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  if (!username || !password) return NextResponse.json({ error: 'enter your username and password' }, { status: 400 });

  // per username (stops guessing one account) and per ip (stops sweeping many)
  const perUser = await rateLimit(`login:${username.toLowerCase()}`, 5, 15 * 60_000);
  const perIp = await rateLimit(`login-ip:${ip}`, 30, 15 * 60_000);
  if (!perUser.ok || !perIp.ok) {
    return NextResponse.json({ error: 'too many attempts. wait a few minutes and try again' }, { status: 429 });
  }

  await ensureIndexes();
  const db = await getDb();
  const account = await db.collection<AccountDoc>('accounts').findOne({ username_lower: username.toLowerCase() });

    // same message and same timing either way, so this can't be used to find out which usernames exist
  const ok = await verifyPassword(password, account?.password_hash ?? (await getDummyHash()));
  if (!account || !ok) {
    return NextResponse.json({ error: WRONG }, { status: 401 });
  }

  await createSession(account._id);
  const player = await db.collection('players').findOne({ user_id: account._id }, { projection: { web_id: 1 } });
  return NextResponse.json({ ok: true, webId: player?.web_id ?? null });
}

// every call is recorded in auth_attempts for the admin page (lib/attempts.ts)
export const POST = logged('login', handle);