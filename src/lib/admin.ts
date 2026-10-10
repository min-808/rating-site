/**
 * Who counts as an admin, and the admin action log. Server-only.
 *
 * Admins are listed by maimai user_id in the ADMIN_USER_IDS environment variable
 * (comma separated), set on Vercel. Being signed in as one of them is the only
 * way into /admin and /api/admin/*. Every admin route checks this itself:
 * hiding a link is not security.
 *
 * admin_log  { at, admin_id, admin_username, action, target_user_id, details }
 */
import { getDb, getSession, type Session } from './auth';

export function adminIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

// the signed-in admin, or null for everyone else (signed out or not on the list)
export async function getAdmin(): Promise<Session | null> {
  const session = await getSession();
  return session && adminIds().includes(session.userId) ? session : null;
}

export type AdminLogDoc = {
  at: Date;
  admin_id: string;
  admin_username: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown>;
};

// records what an admin did, so mistakes can be traced (and undone by hand)
export async function logAdmin(
  admin: Session,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown> = {},
) {
  const db = await getDb();
  await db.collection<AdminLogDoc>('admin_log').insertOne({
    at: new Date(),
    admin_id: admin.userId,
    admin_username: admin.username,
    action,
    target_user_id: targetUserId,
    details,
  });
}