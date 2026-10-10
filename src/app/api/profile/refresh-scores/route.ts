/**
 * GET  /api/profile/refresh-scores   how the signed-in player's refresh stands today
 * POST /api/profile/refresh-scores   starts one
 *
 *   -> { state: 'none' | 'queued' | 'running' | 'done' | 'failed', canRefresh, message }
 *
 * "refresh my scores" in the favorites editor: re-reads the player's scores from
 * maimai NET, so a score from today can be picked as a favorite before the nightly
 * scrape gets to it. Scores only, not the rating.
 *
 * The site can't scrape (the CLAL cookie is on the VPS), so this asks the verify server
 * to start the score scraper for that one player right away (POST /refresh-scores/<id>).
 * Nothing about the refresh is saved here: its progress lives in the verify server's
 * memory, and GET just passes that along.
 *
 * Limits, in rate_limits, keyed by the Hawaii day: once a day per player, at most
 * SITE_DAILY_MAX a day for everyone together, since every refresh is a maimai NET login.
 * They're only used up once the VPS has actually started the refresh, so if it can't be
 * reached, they can just try again. The player comes from the session, never the request.
 */
import { NextResponse } from 'next/server';
import { getDb, getSession, peekRateLimit, rateLimit, verifyFetch } from '../../../../lib/auth';
import { logActivity } from '../../../../lib/activity';

export const dynamic = 'force-dynamic';

const SITE_DAILY_MAX = 20;
const DAY_MS = 24 * 60 * 60_000; // the keys have the day in them, so this only has to outlast it

type State = 'none' | 'queued' | 'running' | 'done' | 'failed';
type VpsStatus = { state: State; error?: string | null };

const hawaiiDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const playerKey = (userId: string) => `refresh-scores:${userId}:${hawaiiDay()}`;
const siteKey = () => `refresh-scores:site:${hawaiiDay()}`;
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

const MESSAGES: Record<State, string> = {
  none: 'manually pull in scores from today that haven\'t shown up yet. once a day',
  queued: 'waiting, about a minute',
  running: 'reading your scores from maimai NET, about a minute',
  done: 'refreshed today. you can refresh again tomorrow',
  failed: 'the refresh didn\'t finish. you can refresh again tomorrow',
};

// what the editor shows. usedToday: today's refresh is spent, even if the VPS has
// forgotten it (after a restart)
function describe(state: State, usedToday: boolean) {
  if (state === 'none' && usedToday) {
    return { state, canRefresh: false, message: 'already refreshed today. you can refresh again tomorrow' };
  }
  return { state, canRefresh: state === 'none', message: MESSAGES[state] };
}

// where this player's refresh stands on the VPS. null when it can't be reached
async function vpsStatus(userId: string): Promise<VpsStatus | null> {
  try {
    const res = await verifyFetch(`/refresh-scores/${encodeURIComponent(userId)}`, { timeoutMs: 8_000 });
    return res.ok ? ((await res.json()) as VpsStatus) : null;
  } catch {
    return null;
  }
}

async function playerFor(userId: string) {
  const db = await getDb();
  // players.user_id may be stored as text or as a number
  return db.collection<{ user_id: string | number; scores_opt_out?: boolean }>('players')
    .findOne({ user_id: { $in: [userId, Number(userId)] } } as object, { projection: { user_id: 1, scores_opt_out: 1 } });
}

export async function GET() {
  const session = await getSession();
  if (!session) return reply({ error: 'sign in first' }, 401);
  const [vps, limit] = await Promise.all([vpsStatus(session.userId), peekRateLimit(playerKey(session.userId), 1)]);
  // can't reach the VPS: show the button as normal, and let a press say what's wrong
  return reply(describe(vps?.state ?? 'none', !limit.ok));
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return reply({ error: 'sign in first' }, 401);

  const player = await playerFor(session.userId);
  if (!player) return reply({ error: 'no profile for this account' }, 404);
  if (player.scores_opt_out) return reply({ error: 'your scores are hidden. turn on "show my scores" first' }, 400);
  const userId = String(player.user_id);

  // checked without counting: they're only used up once the VPS has started it
  if (!(await peekRateLimit(playerKey(userId), 1)).ok) {
    return reply({ ...describe('none', true), error: 'already refreshed today. you can refresh again tomorrow' }, 409);
  }
  if (!(await peekRateLimit(siteKey(), SITE_DAILY_MAX)).ok) {
    return reply({ error: 'lots of people have refreshed today. try again tomorrow' }, 429);
  }

  let res: Response;
  try {
    res = await verifyFetch(`/refresh-scores/${encodeURIComponent(userId)}`, { method: 'POST', timeoutMs: 10_000 });
  } catch {
    return reply({ error: 'couldn\'t reach the server. try again later' }, 503);
  }
  const body = (await res.json().catch(() => ({}))) as Partial<VpsStatus>;
  // already going (a double press): show how it's going
  if (res.status === 409 && body.state) return reply(describe(body.state, true));
  if (res.status === 429) return reply({ error: 'a few refreshes are already going. try again in a few minutes' }, 429);
  if (res.status !== 202) return reply({ error: 'couldn\'t start the refresh. try again later' }, 502);

  await Promise.all([rateLimit(playerKey(userId), 1, DAY_MS), rateLimit(siteKey(), SITE_DAILY_MAX, DAY_MS)]);
  await logActivity(req, session, 'refresh-scores');
  return reply(describe('queued', true));
}
