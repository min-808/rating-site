/**
 * A log of every claim step and sign-in attempt, for the admin page. Server-only.
 *
 * Each route wraps its handler once:
 *
 *   async function handle(req: Request) { ... }        // the route, unchanged
 *   export const POST = logged('claim-start', handle);
 *
 * and every response gets recorded, success or not, with the message the visitor
 * saw. Passwords are never read or stored. Visitors' IPs are stored only as a
 * short hash: enough to tell "same person trying again" apart from "lots of
 * people", without keeping anyone's real address.
 *
 *   auth_attempts {
 *     at, kind, outcome, status, message,
 *     user_id, web_id, username, ip_hash, ms
 *   }
 *   kind:    claim-start | claim-verify | claim-complete | claim-cancel | login
 *   outcome: ok | verified | not-yet | created | reset | blocked | failed | error
 *
 * Entries delete themselves after KEEP_DAYS (a TTL index on `at`).
 */
import { getDb, getClaimToken, sha256, clientIp, type ClaimDoc, type AccountDoc } from './auth';

const KEEP_DAYS = 90;
const COLLECTION = 'auth_attempts';

export type AttemptKind = 'claim-start' | 'claim-verify' | 'claim-complete' | 'claim-cancel' | 'login';
export type AttemptOutcome = 'ok' | 'verified' | 'not-yet' | 'created' | 'reset' | 'blocked' | 'failed' | 'error';

export type AttemptDoc = {
  at: Date;
  kind: AttemptKind;
  outcome: AttemptOutcome;
  status: number;
  message: string | null; // the error the visitor saw, if any
  user_id: string | null;
  web_id: number | null;
  username: string | null; // what they typed (login) or picked (complete)
  ip_hash: string;
  ms: number;
};

// a stable 10-character tag per IP. not reversible in practice, not stored raw
const ipTag = (ip: string) => sha256(`hm-attempts:${ip}`).slice(0, 10);

let indexReady: Promise<unknown> | null = null;
async function collection() {
  const db = await getDb();
  const col = db.collection<AttemptDoc>(COLLECTION);
  indexReady ??= Promise.all([
    col.createIndex({ at: 1 }, { expireAfterSeconds: KEEP_DAYS * 86_400 }),
    col.createIndex({ user_id: 1, at: -1 }),
    col.createIndex({ ip_hash: 1, at: -1 }),
  ]).catch(() => { indexReady = null; });
  await indexReady;
  return col;
}

type Context = Pick<AttemptDoc, 'user_id' | 'web_id' | 'username'> & { hadAccount?: boolean };

// who the attempt is about, read before the handler runs (complete deletes the claim)
async function contextFor(kind: AttemptKind, req: Request): Promise<Context> {
  const ctx: Context = { user_id: null, web_id: null, username: null };
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = await getDb();

  if (kind === 'login') {
    const typed = String(body.username ?? '').trim().slice(0, 40);
    ctx.username = typed || null;
    if (typed) {
      const account = await db
        .collection<AccountDoc>('accounts')
        .findOne({ username_lower: typed.toLowerCase() }, { projection: { _id: 1 } });
      ctx.user_id = account?._id ?? null;
    }
  } else if (kind === 'claim-start') {
    const webId = Number(body.webId);
    if (Number.isInteger(webId)) {
      ctx.web_id = webId;
      const player = await db.collection('players').findOne({ web_id: webId }, { projection: { user_id: 1 } });
      ctx.user_id = player ? String(player.user_id) : null;
    }
  } else {
    // verify / complete / cancel: the claim this browser has going
    const token = await getClaimToken();
    const claim = token ? await db.collection<ClaimDoc>('claims').findOne({ _id: sha256(token) }) : null;
    ctx.user_id = claim?.user_id ?? null;
    ctx.web_id = claim?.web_id ?? null;
    if (kind === 'claim-complete') {
      ctx.username = String(body.username ?? '').trim().slice(0, 40) || null;
      if (claim) {
        ctx.hadAccount = Boolean(
          await db.collection<AccountDoc>('accounts').findOne({ _id: claim.user_id }, { projection: { _id: 1 } }),
        );
      }
    }
  }
  return ctx;
}

// what happened, from the response the visitor got
function outcomeFor(kind: AttemptKind, status: number, data: Record<string, unknown> | null, ctx: Context): AttemptOutcome {
  if (status >= 500) return status === 503 ? 'blocked' : 'error';
  if (status === 409 || status === 429 || status === 403) return 'blocked';
  if (status >= 400) return 'failed';
  if (kind === 'claim-verify') return data?.verified ? 'verified' : 'not-yet';
  if (kind === 'claim-complete') return ctx.hadAccount ? 'reset' : 'created';
  return 'ok';
}

/**
 * Wraps a route handler so every call is recorded. Logging problems are only
 * printed; they never change or break the response.
 */
export function logged(kind: AttemptKind, handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const started = Date.now();
    const ip = clientIp(req);
    const ctx = await contextFor(kind, req.clone()).catch(() => ({ user_id: null, web_id: null, username: null }) as Context);

    let res: Response;
    try {
      res = await handler(req);
    } catch (error) {
      await record(kind, 'error', 500, error instanceof Error ? error.message : String(error), ctx, ip, started);
      throw error;
    }

    const data = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null;
    const message = typeof data?.error === 'string' ? data.error : null;
    await record(kind, outcomeFor(kind, res.status, data, ctx), res.status, message, ctx, ip, started);
    return res;
  };
}

async function record(
  kind: AttemptKind, outcome: AttemptOutcome, status: number, message: string | null,
  ctx: Context, ip: string, started: number,
) {
  try {
    const col = await collection();
    await col.insertOne({
      at: new Date(),
      kind,
      outcome,
      status,
      message: message ? message.slice(0, 300) : null,
      user_id: ctx.user_id,
      web_id: ctx.web_id,
      username: ctx.username,
      ip_hash: ipTag(ip),
      ms: Date.now() - started,
    });
  } catch (error) {
    console.error('[attempts] could not record attempt:', error);
  }
}