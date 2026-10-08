/**
 * A log of what signed-in players do on the site, for the admin page. Server-only.
 *
 *   user_activity {
 *     at, user_id, username, action, before, after, ip_hash
 *   }
 *   action: bio | favorites | scores | sign-out
 *     bio        before / after: the old and new bio text (null when there was none)
 *     favorites  before / after: the old and new lists of chart keys
 *     scores     before / after: "shown" or "hidden" (they hid or showed their scores)
 *     sign-out   nothing extra
 *
 * Sign-ins and claim steps aren't here: they're already in auth_attempts
 * (lib/attempts.ts). Admin actions are in admin_log (lib/admin.ts).
 *
 * IPs are stored as the same short hash auth_attempts uses, never raw. Entries
 * delete themselves after KEEP_DAYS (a TTL index on `at`).
 */
import { getDb, clientIp, type Session } from './auth';
import { ipTag } from './attempts';

const KEEP_DAYS = 180;
const COLLECTION = 'user_activity';

export type ActivityAction = 'bio' | 'favorites' | 'scores' | 'sign-out';

export type ActivityDoc = {
  at: Date;
  user_id: string;
  username: string;
  action: ActivityAction;
  before: unknown;
  after: unknown;
  ip_hash: string;
};

let indexReady: Promise<unknown> | null = null;
async function collection() {
  const db = await getDb();
  const col = db.collection<ActivityDoc>(COLLECTION);
  indexReady ??= Promise.all([
    col.createIndex({ at: 1 }, { expireAfterSeconds: KEEP_DAYS * 86_400 }),
    col.createIndex({ user_id: 1, at: -1 }),
    col.createIndex({ ip_hash: 1, at: -1 }),
  ]).catch(() => { indexReady = null; });
  await indexReady;
  return col;
}

/**
 * Records one thing a player did. A logging problem is only printed: it never
 * changes or breaks what they were doing.
 */
export async function logActivity(
  req: Request,
  session: Session,
  action: ActivityAction,
  change: { before?: unknown; after?: unknown } = {},
) {
  try {
    const col = await collection();
    await col.insertOne({
      at: new Date(),
      user_id: session.userId,
      username: session.username,
      action,
      before: change.before ?? null,
      after: change.after ?? null,
      ip_hash: ipTag(clientIp(req)),
    });
  } catch (error) {
    console.error('[activity] could not record activity:', error);
  }
}
