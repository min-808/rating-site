/**
 * POST /api/profile/bio   { bio }
 *
 * Saves the signed-in player's bio. The account to change comes from the session,
 * never from the request, so nobody can edit someone else's profile.
 * An empty bio removes it.
 */
import { NextResponse } from 'next/server';
import { type AccountDoc, getDb, getSession, rateLimit } from '../../../../lib/auth';
import { cleanBio, checkBio } from '../../../../lib/bio';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail(401, 'sign in to edit your profile');

  const body = (await req.json().catch(() => ({}))) as { bio?: unknown };
  if (typeof body.bio !== 'string') return fail(400, 'missing bio');

  const bio = cleanBio(body.bio);
  const problem = checkBio(bio);
  if (problem) return fail(400, problem);

  // generous for a person, stops a script hammering the database
  const limit = await rateLimit(`bio:${session.userId}`, 30, 60 * 60_000);
  if (!limit.ok) return fail(429, "you've saved a lot recently. try again in a bit");

  const db = await getDb();
  await db.collection<AccountDoc & { bio?: string; bio_updated_at?: Date }>('accounts').updateOne(
    { _id: session.userId },
    bio ? { $set: { bio, bio_updated_at: new Date() } } : { $unset: { bio: '', bio_updated_at: '' } },
  );

  return NextResponse.json({ bio: bio || null });
}