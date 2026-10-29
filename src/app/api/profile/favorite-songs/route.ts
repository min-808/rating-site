/**
 * GET  /api/profile/favorite-songs                      ->  { signedIn: false }
 *                                                       or  { signedIn: true, ids: string[] }
 * POST /api/profile/favorite-songs  { id, favorite }    ->  { favorite }
 *
 * The signed-in player's hearted songs. ids are song ids (the /charts/<id> address,
 * lib/song-id.ts); they are kept on the account as song keys (lib/song-catalog.ts), which
 * don't change when an address does. The account comes from the
 * session, never from the request. Adding checks that the song exists and that the list
 * isn't full (FAVORITE_SONGS_MAX); removing never fails for a song that isn't there.
 */
import { NextResponse } from 'next/server';
import { type AccountDoc, getDb, getSession, rateLimit } from '../../../../lib/auth';
import { FAVORITE_SONGS_MAX } from '../../../../lib/favorite-songs';
import { getCatalog, getCatalogSong } from '../../../../lib/song-catalog';

export const dynamic = 'force-dynamic';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });
const NO_STORE = { 'Cache-Control': 'no-store' };

// saved keys -> today's addresses. a key no song has any more is left out
async function idsFor(keys: string[]) {
  const idByKey = new Map((await getCatalog()).map((song) => [song.key, song.id]));
  return keys.flatMap((key) => (idByKey.has(key) ? [idByKey.get(key)!] : []));
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ signedIn: false }, { headers: NO_STORE });

  const db = await getDb();
  const account = await db
    .collection<AccountDoc>('accounts')
    .findOne({ _id: session.userId }, { projection: { favorite_songs: 1 } });
  return NextResponse.json(
    { signedIn: true, ids: await idsFor(account?.favorite_songs ?? []) },
    { headers: NO_STORE },
  );
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail(401, 'sign in to favorite songs');

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; favorite?: unknown };
  if (typeof body.id !== 'string' || body.id.length > 600 || typeof body.favorite !== 'boolean') {
    return fail(400, 'missing song');
  }

  // a heart is a tap, so this is generous for a person and stops a script hammering the database
  const limit = await rateLimit(`favorite-songs:${session.userId}`, 240, 60 * 60_000);
  if (!limit.ok) return fail(429, "you've favorited a lot recently. try again in a bit");

  const accounts = (await getDb()).collection<AccountDoc>('accounts');

  if (!body.favorite) {
    const song = await getCatalogSong(body.id);
    if (song) await accounts.updateOne({ _id: session.userId }, { $pull: { favorite_songs: song.key } });
    return NextResponse.json({ favorite: false });
  }

  const song = await getCatalogSong(body.id);
  if (!song) return fail(404, "that song doesn't exist");

  // only adds while the list has room (the index just past the last allowed one is empty)
  const result = await accounts.updateOne(
    { _id: session.userId, [`favorite_songs.${FAVORITE_SONGS_MAX - 1}`]: { $exists: false } },
    { $addToSet: { favorite_songs: song.key } },
  );
  if (result.matchedCount === 0) return fail(400, `you can favorite up to ${FAVORITE_SONGS_MAX} songs`);
  return NextResponse.json({ favorite: true });
}
