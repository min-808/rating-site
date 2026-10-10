/**
 * POST /api/profile/scores-visibility   { hidden: boolean }
 *
 * Lets a signed-in player hide their scores from their profile, or show them again:
 * sets scores_opt_out on their player. Hidden means the best 50, play stats, level
 * breakdown and favorites don't show, for anyone, and the nightly score scraper skips
 * them. Their rating and rank stay on the leaderboard. The player to change comes
 * from the session, never from the request.
 */
import { NextResponse } from 'next/server';
import { getDb, getSession, rateLimit } from '../../../../lib/auth';
import { logActivity } from '../../../../lib/activity';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail(401, 'sign in to change this');

  const body = (await req.json().catch(() => ({}))) as { hidden?: unknown };
  if (typeof body.hidden !== 'boolean') return fail(400, 'missing hidden');
  const hidden = body.hidden;

  // generous for a person, stops a script flipping it over and over
  const limit = await rateLimit(`scores-visibility:${session.userId}`, 20, 60 * 60_000);
  if (!limit.ok) return fail(429, "you've changed this a lot recently. try again in a bit");

  const db = await getDb();
  // players.user_id may be stored as text or as a number
  const players = db.collection<{ scores_opt_out?: boolean }>('players');
  const filter = { user_id: { $in: [session.userId, Number(session.userId)] } } as object;
  const player = await players.findOne(filter, { projection: { scores_opt_out: 1 } });
  if (!player) return fail(404, 'no profile for this account');

  const before = Boolean(player.scores_opt_out);
  if (before !== hidden) {
    await players.updateOne(filter, { $set: { scores_opt_out: hidden } });
    await logActivity(req, session, 'scores', { before: before ? 'hidden' : 'shown', after: hidden ? 'hidden' : 'shown' });
  }

  return NextResponse.json({ hidden });
}
