import { unstable_cache, revalidateTag } from 'next/cache';
import { connectMongo, getMongoClient } from './connect-db';
import type { PlayerDocument } from './leaderboard';

/**
 * A player's record (their scores are most of it, a few hundred KB) for the profile and
 * level summary pages, cached on the server for CACHE_SECONDS rather than read from
 * MongoDB on every view.
 *
 * Cleared sooner when something changes it:
 *   - the player's own cache: when they show or hide their scores (or an admin does), and
 *     when their "refresh my scores" finishes (clearPlayerCache)
 *   - everyone's: every night, by /api/update-leaderboard (PLAYERS_TAG)
 * Anything else (the scrapers' other writes) shows up within CACHE_SECONDS. Server only.
 */

export const PLAYERS_TAG = 'players';
const CACHE_SECONDS = 5 * 60;
const tagFor = (webId: number) => `player-${webId}`;

export function getPlayerByWebId(webId: number): Promise<PlayerDocument | null> {
  return unstable_cache(
    async () => {
      await connectMongo();
      const doc = await (await getMongoClient()).db('maimai').collection('players').findOne({ web_id: webId });
      // plain JSON, which is what the cache keeps (dates come back as text)
      return doc ? (JSON.parse(JSON.stringify(doc)) as PlayerDocument) : null;
    },
    ['player', String(webId)],
    { revalidate: CACHE_SECONDS, tags: [PLAYERS_TAG, tagFor(webId)] },
  )();
}

/** Drops one player's cached record, so their next page view reads it fresh. */
export function clearPlayerCache(webId: number | null | undefined) {
  if (webId != null) revalidateTag(tagFor(webId), 'max');
}
