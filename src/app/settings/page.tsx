import Link from 'next/link';
import type { Metadata } from 'next';
import { type AccountDoc, getDb, getSession } from '../../lib/auth';
import { nextUsernameChange } from '../../lib/account-settings';
import SettingsForms from '../../components/SettingsForms';
import { isGf } from '../../lib/special-players';

/**
 * /settings: the signed-in player's account settings (components/SettingsForms.tsx):
 * change username (once a week), change password, show or hide their scores (and, for the
 * one player with japanese-site scores, whether those show: lib/jp-scores.ts), and sign
 * out everywhere. Signed out, it just points to sign in.
 */

export const metadata: Metadata = { title: 'Settings - HI Maimai' };

// reads the session cookie, so it's rendered fresh for every visitor
export const dynamic = 'force-dynamic';

const css = `
  .st-wrap { max-width: 760px; margin: 0 auto; padding: 1rem 1rem 3rem; font-family: sans-serif; }
  .st-back { display: inline-block; margin-bottom: 1rem; font-size: 0.85rem; color: var(--text-sub); text-decoration: none; }
  .st-back:hover { color: #2563eb; }
  .st-wrap h1 { margin: 0 0 1.25rem; font-size: 1.8rem; }
  .st-empty { color: var(--text-sub); }
  .st-empty a { color: #2563eb; }
`;

export default async function SettingsPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="st-wrap">
        <style>{css}</style>
        <h1>settings</h1>
        <p className="st-empty"><Link href="/login">sign in</Link> to change your settings</p>
      </main>
    );
  }

  const db = await getDb();
  const [account, player] = await Promise.all([
    db.collection<AccountDoc & { show_jp_scores?: boolean }>('accounts')
      .findOne({ _id: session.userId }, { projection: { username: 1, username_changed_at: 1, show_jp_scores: 1 } }),
    // players.user_id may be stored as text or as a number
    db.collection<{ web_id?: number; scores_opt_out?: boolean }>('players')
      .findOne({ user_id: { $in: [session.userId, Number(session.userId)] } } as object, { projection: { web_id: 1, scores_opt_out: 1 } }),
  ]);
  const next = nextUsernameChange(account?.username_changed_at);

  return (
    <main className="st-wrap">
      <style>{css}</style>
      {player?.web_id != null && <Link href={`/user/${player.web_id}`} className="st-back">← back to your profile</Link>}
      <h1>settings</h1>
      <SettingsForms
        username={account?.username ?? session.username}
        nextUsernameChange={next ? next.toISOString() : null}
        scoresHidden={Boolean(player?.scores_opt_out)}
        // null: no switch. otherwise whether they're shown (unset counts as shown)
        jpScoresShown={isGf(session.userId) ? account?.show_jp_scores !== false : null}
      />
    </main>
  );
}
