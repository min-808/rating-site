/**
 * POST /api/admin/action   { action, userId?, claimId? }
 *
 * Every admin button goes through here. It checks that the signed-in visitor is
 * an admin (ADMIN_USER_IDS) before doing anything, and writes each action to
 * admin_log.
 *
 *   clear-bio       { userId }   removes the bio from that account
 *   unclaim         { userId }   deletes the account, signs it out everywhere, drops
 *                                its claims. the profile and scores stay; it can be claimed again
 *   sign-out        { userId }   signs the account out on every device, keeps the account
 *   hide-scores     { userId }   hides a player's best 50 and play stats (scores_opt_out),
 *   show-scores     { userId }   or shows them again. works on unclaimed profiles too
 *   cancel-claim    { claimId }  ends one in-progress claim and frees the slot if it held it
 *   free-slot       {}           frees the one-claim-at-a-time slot, whoever holds it
 */
import { NextResponse } from 'next/server';
import { type AccountDoc, type ClaimDoc, type SessionDoc, getDb } from '../../../../lib/auth';
import { getAdmin, logAdmin } from '../../../../lib/admin';

export const dynamic = 'force-dynamic';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

// the slot document from lib/claim-gate.ts
type LockDoc = { _id: string; holder: string; until: Date };
const SLOT = 'maimai-net';

export async function POST(req: Request) {
  const admin = await getAdmin();
  // same answer as a page that doesn't exist, so the route doesn't advertise itself
  if (!admin) return fail(404, 'not found');

  // only accept JSON, which a form on another site can't send without the browser asking first
  if (!req.headers.get('content-type')?.includes('application/json')) return fail(415, 'send json');

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; userId?: unknown; claimId?: unknown };
  const action = String(body.action ?? '');
  const userId = typeof body.userId === 'string' && /^\d{5,20}$/.test(body.userId) ? body.userId : null;
  const claimId = typeof body.claimId === 'string' && /^[0-9a-f]{64}$/.test(body.claimId) ? body.claimId : null;

  const db = await getDb();
  const accounts = db.collection<AccountDoc & { bio?: string }>('accounts');
  const claims = db.collection<ClaimDoc>('claims');
  const locks = db.collection<LockDoc>('locks');
  // players.user_id may be stored as text or as a number
  const playerFilter = (id: string) => ({ user_id: { $in: [id, Number(id)] } });

  switch (action) {
    case 'clear-bio': {
      if (!userId) return fail(400, 'missing userId');
      const account = await accounts.findOne({ _id: userId }, { projection: { username: 1, bio: 1 } });
      if (!account) return fail(404, 'no account for that player');
      await accounts.updateOne({ _id: userId }, { $unset: { bio: '', bio_updated_at: '' } });
      // the old bio goes in the log, so it can be put back if this was a mistake
      await logAdmin(admin, 'clear-bio', userId, { username: account.username, old_bio: account.bio ?? null });
      return NextResponse.json({ ok: true });
    }

    case 'sign-out': {
      if (!userId) return fail(400, 'missing userId');
      const account = await accounts.findOne({ _id: userId }, { projection: { username: 1 } });
      if (!account) return fail(404, 'no account for that player');
      const { deletedCount } = await db.collection<SessionDoc>('sessions').deleteMany({ user_id: userId });
      await logAdmin(admin, 'sign-out', userId, { username: account.username, sessions_ended: deletedCount });
      return NextResponse.json({ ok: true, sessionsEnded: deletedCount });
    }

    case 'hide-scores':
    case 'show-scores': {
      if (!userId) return fail(400, 'missing userId');
      const hide = action === 'hide-scores';
      const { matchedCount } = await db.collection('players').updateOne(playerFilter(userId), { $set: { scores_opt_out: hide } });
      if (!matchedCount) return fail(404, 'no player with that id');
      await logAdmin(admin, action, userId);
      return NextResponse.json({ ok: true });
    }

    case 'unclaim': {
      if (!userId) return fail(400, 'missing userId');
      if (userId === admin.userId) return fail(400, "you can't unclaim your own account from here");
      const account = await accounts.findOne({ _id: userId }, { projection: { username: 1, bio: 1, created_at: 1 } });
      if (!account) return fail(404, 'no account for that player');
      const [, sessions] = await Promise.all([
        accounts.deleteOne({ _id: userId }),
        db.collection<SessionDoc>('sessions').deleteMany({ user_id: userId }),
        claims.deleteMany({ user_id: userId }),
      ]);
      await logAdmin(admin, 'unclaim', userId, {
        username: account.username,
        bio: account.bio ?? null,
        created_at: account.created_at ?? null,
        sessions_ended: sessions.deletedCount,
      });
      return NextResponse.json({ ok: true });
    }

    case 'cancel-claim': {
      if (!claimId) return fail(400, 'missing claimId');
      const claim = await claims.findOne({ _id: claimId });
      if (!claim) return fail(404, 'that claim already ended');
      await Promise.all([claims.deleteOne({ _id: claimId }), locks.deleteOne({ _id: SLOT, holder: claimId })]);
      await logAdmin(admin, 'cancel-claim', claim.user_id, { web_id: claim.web_id, started_at: claim.started_at });
      return NextResponse.json({ ok: true });
    }

    case 'free-slot': {
      const slot = await locks.findOne({ _id: SLOT });
      await locks.deleteOne({ _id: SLOT });
      await logAdmin(admin, 'free-slot', null, { holder: slot?.holder ?? null, until: slot?.until ?? null });
      return NextResponse.json({ ok: true });
    }

    default:
      return fail(400, 'unknown action');
  }
}