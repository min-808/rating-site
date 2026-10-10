/**
 * POST /api/profile/favorites   { favorites: string[] }
 *
 * Saves the signed-in player's favorite scores: up to five charts (FAVORITES_MAX), in order, by
 * chart key ("<difficulty>-<kind>-<title>", the key the score cards use). The
 * account to change comes from the session, never from the request, and every
 * chart has to be one they've actually played. An empty list removes them.
 */
import { NextResponse } from 'next/server';
import { type AccountDoc, getDb, getSession, rateLimit } from '../../../../lib/auth';
import { FAVORITES_MAX, favoriteKey } from '../../../../lib/favorites';
import { logActivity } from '../../../../lib/activity';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

type PlayedChart = { title: string; kind: string; difficulty: string; achievement?: number | null };

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail(401, 'sign in to edit your profile');

  const body = (await req.json().catch(() => ({}))) as { favorites?: unknown };
  if (!Array.isArray(body.favorites) || !body.favorites.every((k) => typeof k === 'string' && k.length <= 400)) {
    return fail(400, 'missing favorites');
  }
  const favorites = [...new Set(body.favorites as string[])];
  if (favorites.length > FAVORITES_MAX) return fail(400, `pick up to ${FAVORITES_MAX} favorites`);

  // generous for a person, stops a script hammering the database
  const limit = await rateLimit(`favorites:${session.userId}`, 60, 60 * 60_000);
  if (!limit.ok) return fail(429, "you've saved a lot recently. try again in a bit");

  const db = await getDb();

  // only charts on their own record. players.user_id may be stored as text or a number
  const player = await db.collection<{ songs?: PlayedChart[] }>('players').findOne(
    { user_id: { $in: [session.userId, Number(session.userId)] } } as object,
    { projection: { 'songs.title': 1, 'songs.kind': 1, 'songs.difficulty': 1, 'songs.achievement': 1 } },
  );
  const played = new Set((player?.songs ?? []).filter((s) => (s.achievement ?? 0) > 0).map(favoriteKey));
  if (favorites.some((key) => !played.has(key))) return fail(400, "you can only pick charts you've played");

  const accounts = db.collection<AccountDoc & { favorites?: string[] }>('accounts');
  // the old list, for the admin page's activity log
  const before = (await accounts.findOne({ _id: session.userId }, { projection: { favorites: 1 } }))?.favorites ?? [];
  await accounts.updateOne(
    { _id: session.userId },
    favorites.length ? { $set: { favorites } } : { $unset: { favorites: '' } },
  );
  if (before.join('\n') !== favorites.join('\n')) {
    await logActivity(req, session, 'favorites', { before, after: favorites });
  }

  return NextResponse.json({ favorites });
}
