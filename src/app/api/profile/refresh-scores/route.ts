/**
 * GET  /api/profile/refresh-scores   how the signed-in player's refresh stands today
 * POST /api/profile/refresh-scores   asks for one
 *
 *   -> { state: 'none' | 'queued' | 'running' | 'done' | 'failed', canRefresh, message, finishedAt }
 *
 * "refresh my scores" in the favorites editor: re-reads the player's scores from
 * maimai NET, so a score from today can be picked as a favorite before the nightly
 * scrape gets to it. Scores only, not the rating.
 *
 * The site can't scrape (the CLAL cookie is on the VPS), so this only leaves a request
 * in score_refreshes; rating-scraper/refresh-worker.js picks it up within a minute and
 * runs the normal score scraper for that one player.
 *
 * Limits: once per Hawaii day per player (a failed one can be tried again), at most
 * SITE_DAILY_MAX a day for everyone together, since every refresh is a maimai NET login.
 * The player comes from the session, never from the request.
 */
import { NextResponse } from 'next/server';
import { getDb, getSession, rateLimit } from '../../../../lib/auth';
import { logActivity } from '../../../../lib/activity';

export const dynamic = 'force-dynamic';

const SITE_DAILY_MAX = 20;
// a request that's been waiting or running this long almost certainly died: let them retry
const STUCK_MS = 15 * 60_000;

type RefreshDoc = {
  _id: string; // user_id
  day: string; // Hawaii date it was asked for, "2026-10-09"
  state: 'queued' | 'running' | 'done' | 'failed';
  requested_at: Date;
  started_at?: Date | null;
  finished_at?: Date | null;
  error?: string | null;
};

const hawaiiDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// what the editor shows for a refresh doc (or none)
function describe(doc: RefreshDoc | null) {
  const today = hawaiiDay();
  if (!doc || doc.day !== today) {
    return { state: 'none', canRefresh: true, message: 'pull in scores from today that haven\'t shown up yet. once a day', finishedAt: null };
  }
  const stuck = (doc.state === 'queued' || doc.state === 'running') && Date.now() - new Date(doc.requested_at).getTime() > STUCK_MS;
  const state = stuck ? 'failed' : doc.state;
  const finishedAt = doc.finished_at ? new Date(doc.finished_at).toISOString() : null;
  switch (state) {
    case 'queued': return { state, canRefresh: false, message: 'waiting to start, usually under a minute', finishedAt };
    case 'running': return { state, canRefresh: false, message: 'reading your scores from maimai NET, about a minute', finishedAt };
    case 'done': return { state, canRefresh: false, message: 'refreshed today. you can refresh again tomorrow (hawaii time)', finishedAt };
    default: return { state: 'failed', canRefresh: true, message: 'the last refresh didn\'t finish. you can try again', finishedAt };
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
  const db = await getDb();
  const doc = await db.collection<RefreshDoc>('score_refreshes').findOne({ _id: session.userId });
  return reply(describe(doc));
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return reply({ error: 'sign in first' }, 401);

  const player = await playerFor(session.userId);
  if (!player) return reply({ error: 'no profile for this account' }, 404);
  if (player.scores_opt_out) return reply({ error: 'your scores are hidden. turn on "show my scores" first' }, 400);

  const db = await getDb();
  const refreshes = db.collection<RefreshDoc>('score_refreshes');
  const today = hawaiiDay();
  const current = describe(await refreshes.findOne({ _id: session.userId }));
  if (!current.canRefresh) return reply({ ...current, error: current.message }, 409);

  // a few tries a day at most, counting retries after a failure. after the check above,
  // so pressing it once you've already refreshed doesn't use any up
  const limit = await rateLimit(`refresh-scores:${session.userId}`, 4, 24 * 60 * 60_000);
  if (!limit.ok) return reply({ error: 'too many refreshes today. try again tomorrow' }, 429);

  // everyone together, today
  const todayCount = await refreshes.countDocuments({ day: today, state: { $ne: 'failed' } });
  if (todayCount >= SITE_DAILY_MAX) return reply({ error: 'lots of people have refreshed today. try again tomorrow' }, 429);

  const doc: RefreshDoc = {
    _id: String(player.user_id),
    day: today,
    state: 'queued',
    requested_at: new Date(),
    started_at: null,
    finished_at: null,
    error: null,
  };
  await refreshes.replaceOne({ _id: doc._id }, doc, { upsert: true });
  await logActivity(req, session, 'refresh-scores');
  return reply(describe(doc));
}
