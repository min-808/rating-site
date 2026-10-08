import Link from 'next/link';
import type { Metadata } from 'next';
import ClaimPanel from '../../../components/ClaimPanel';
import SignOutButton from '../../../components/SignOutButton';
import { getSession, getDb } from '../../../lib/auth';
import { toNormalWidth } from '../../../lib/leaderboard';

/**
 * /login/reset: forgot your password.
 *
 *   ?q=<name or profile number>   finds claimed profiles to pick from
 *   ?profile=<web_id>             runs the reset (the claim flow) for that profile
 *
 * It searches by in-game name, never by site username: usernames aren't public,
 * and a username search would tell anyone which profile owns which username.
 * Only profiles with an account are listed, since there's nothing to reset on
 * the others (and "claimed profile" already shows on every profile page).
 */

export const metadata: Metadata = {
  title: 'Reset your Password - HI Maimai',
};

// reads the session cookie, so it's rendered fresh for every visitor
export const dynamic = 'force-dynamic';

const MAX_RESULTS = 10;

const css = `
  .rs-wrap { max-width: 460px; margin: 0 auto; padding: 2rem 1rem 3rem; font-family: sans-serif; }
  .rs-back { display: inline-block; font-size: 0.85rem; color: var(--text-sub); text-decoration: none; margin-bottom: 1rem; }
  .rs-back:hover { color: #2563eb; }
  .rs-card { padding: 1.4rem 1.5rem; border-radius: 12px; border: 1px solid var(--border-light); }
  .rs-card h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
  .rs-help { margin: 0 0 1rem; font-size: 0.85rem; line-height: 1.5; color: var(--text-sub); }
  .rs-search { display: flex; gap: 8px; }
  .rs-search input { flex: 1; min-width: 0; font: inherit; padding: 8px 10px; border-radius: 7px;
    border: 1px solid var(--border-light); background: transparent; color: inherit; }
  .rs-search input:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .rs-btn { border: 0; border-radius: 8px; padding: 8px 16px; font: inherit; font-weight: 700; cursor: pointer;
    background: #2563eb; color: #fff; }
  .rs-btn:hover:not(:disabled) { background: #1d4ed8; }
  .rs-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .rs-btn-quiet { width: 100%; background: transparent; color: var(--text-sub); border: 1px solid var(--border-light); }
  .rs-btn-quiet:hover:not(:disabled) { background: rgba(127,127,127,0.12); }
  .rs-list { list-style: none; margin: 1rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .rs-list a { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 8px 12px;
    border-radius: 8px; border: 1px solid var(--border-light); color: inherit; text-decoration: none; }
  .rs-list a:hover { border-color: #2563eb; }
  .rs-list a:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .rs-name { font-weight: 700; overflow-wrap: anywhere; }
  .rs-rating { font-size: 0.8rem; color: var(--text-sub); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .rs-empty { margin: 1rem 0 0; font-size: 0.85rem; color: var(--text-sub); }
  .rs-empty a, .rs-help a { color: #2563eb; }
`;

type PlayerLite = { user_id: string | number; web_id: number; name: string; rating?: number };
const PLAYER_FIELDS = { user_id: 1, web_id: 1, name: 1, rating: 1 } as const;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "abc" -> "ａｂｃ", since in-game names are often saved full-width
const toFullWidth = (s: string) =>
  s.replace(/[!-~]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xfee0)).replace(/ /g, '　');

// which of these players have an account (players.user_id may be text or a number; accounts._id is text)
async function claimedIds(players: PlayerLite[]) {
  if (players.length === 0) return new Set<string>();
  const db = await getDb();
  const docs = await db
    .collection<{ _id: string }>('accounts')
    .find({ _id: { $in: players.map((p) => String(p.user_id)) } }, { projection: { _id: 1 } })
    .toArray();
  return new Set(docs.map((d) => d._id));
}

async function search(q: string): Promise<PlayerLite[]> {
  const db = await getDb();
  const players = db.collection<PlayerLite>('players');

  let found: PlayerLite[];
  if (/^\d{1,7}$/.test(q)) {
    // a profile number, from the end of their profile's link
    found = await players.find({ web_id: Number(q) }, { projection: PLAYER_FIELDS }).limit(1).toArray();
  } else {
    const patterns = [...new Set([q, toFullWidth(q)])].map((p) => ({ $regex: escapeRegex(p), $options: 'i' }));
    found = await players
      .find(
        { $or: patterns.flatMap((p) => [{ name: p }, { name_half: p }]) },
        { projection: PLAYER_FIELDS },
      )
      .sort({ currentRank: 1 })
      .limit(50)
      .toArray();
  }

  const claimed = await claimedIds(found);
  return found.filter((p) => claimed.has(String(p.user_id))).slice(0, MAX_RESULTS);
}

export default async function ResetPage({ searchParams }: {
  searchParams: Promise<{ q?: string; profile?: string }>;
}) {
  const session = await getSession();
  const { q: rawQuery, profile } = await searchParams;
  const q = (rawQuery ?? '').trim().slice(0, 40);
  const backToSearch = q ? `/login/reset?q=${encodeURIComponent(q)}` : '/login/reset';

  // signed in already: resetting is for getting back in, and the claim routes refuse signed-in browsers
  if (session) {
    return (
      <main className="rs-wrap">
        <style>{css}</style>
        <Link href="/login" className="rs-back">← back to sign in</Link>
        <div className="rs-card">
          <h1>you&apos;re signed in</h1>
          <p className="rs-help">
            you&apos;re signed in as <b>{session.username}</b>. to reset a different account&apos;s password, sign out first
          </p>
          <SignOutButton className="rs-btn rs-btn-quiet" />
        </div>
      </main>
    );
  }

  // a profile was picked: run the reset for it
  if (/^\d{1,7}$/.test(profile ?? '')) {
    const db = await getDb();
    const player = await db
      .collection<PlayerLite>('players')
      .findOne({ web_id: Number(profile) }, { projection: PLAYER_FIELDS });
    const claimed = player ? (await claimedIds([player])).size > 0 : false;

    return (
      <main className="rs-wrap">
        <style>{css}</style>
        <Link href={backToSearch} className="rs-back">← back to search</Link>
        {player && claimed ? (
          <ClaimPanel
            webId={player.web_id}
            playerName={toNormalWidth(player.name)}
            claimed
            isOwner={false}
            signedInAs={null}
            captchaSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
            standalone={{ closeHref: backToSearch }}
          />
        ) : (
          <div className="rs-card">
            <h1>nothing to reset</h1>
            <p className="rs-help">
              {player ? (
                <>
                  <b>{toNormalWidth(player.name)}</b> doesn&apos;t have an account yet. you can{' '}
                  <Link href={`/user/${player.web_id}`}>claim the profile</Link> instead
                </>
              ) : (
                <>that profile doesn&apos;t exist. <Link href="/login/reset">search again</Link></>
              )}
            </p>
          </div>
        )}
      </main>
    );
  }

  const results = q ? await search(q) : [];

  return (
    <main className="rs-wrap">
      <style>{css}</style>
      <Link href="/login" className="rs-back">← back to sign in</Link>
      <div className="rs-card">
        <h1>reset your password</h1>
        <p className="rs-help">
          find your maimai profile by its in game name. you&apos;ll prove it&apos;s yours by changing your title
          for a moment, then set a new password
        </p>

        <form className="rs-search" action="/login/reset" method="get" role="search">
          <input name="q" defaultValue={q} placeholder="in-game name" aria-label="in-game name"
            autoComplete="off" autoFocus maxLength={40} required />
          <button type="submit" className="rs-btn">search</button>
        </form>

        {q && (results.length > 0 ? (
          <ul className="rs-list">
            {results.map((p) => (
              <li key={p.web_id}>
                <Link href={`/login/reset?q=${encodeURIComponent(q)}&profile=${p.web_id}`}>
                  <span className="rs-name">{toNormalWidth(p.name)}</span>
                  {p.rating != null && <span className="rs-rating">{p.rating}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rs-empty">
            no claimed profile matches &quot;{q}&quot;. if you never made an account, find your profile on
            the <Link href="/">leaderboard</Link> and claim it there
          </p>
        ))}
      </div>
    </main>
  );
}
