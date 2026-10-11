/**
 * POST /api/profile/jp-scores   { shown: boolean }
 *
 * "show japan scores" in the account menu: whether the profile combines the player's
 * japanese-site scores with their international ones (lib/jp-scores.ts). Only for the
 * one player who has japanese scores (GF_USER_ID); anyone else gets a 403. Saved as
 * show_jp_scores on their account (unset counts as shown). The player comes from the
 * session, never from the request.
 */
import { NextResponse } from 'next/server';
import { getDb, getSession, rateLimit } from '../../../../lib/auth';
import { isGf } from '../../../../lib/special-players';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail(401, 'sign in to change this');
  if (!isGf(session.userId)) return fail(403, "this account doesn't have japan scores");

  const body = (await req.json().catch(() => ({}))) as { shown?: unknown };
  if (typeof body.shown !== 'boolean') return fail(400, 'missing shown');

  // generous for a person, stops a script flipping it over and over
  const limit = await rateLimit(`jp-scores:${session.userId}`, 20, 60 * 60_000);
  if (!limit.ok) return fail(429, "you've changed this a lot recently. try again in a bit");

  const db = await getDb();
  await db.collection<{ _id: string }>('accounts').updateOne({ _id: session.userId }, { $set: { show_jp_scores: body.shown } });
  return NextResponse.json({ shown: body.shown });
}
