import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { type AccountDoc, type ClaimDoc, getDb } from '../../lib/auth';
import { getAdmin, type AdminLogDoc } from '../../lib/admin';
import { toNormalWidth } from '../../lib/leaderboard';
import AdminButton from '../../components/AdminButton';
import type { AttemptDoc, AttemptKind, AttemptOutcome } from '../../lib/attempts';

/**
 * /admin: only for accounts listed in ADMIN_USER_IDS. Everyone else gets the
 * normal 404 page, so it doesn't advertise that it exists.
 *
 *   claims    whether the one-claim slot is taken, every claim in progress
 *   attempts  every claim step and sign-in attempt (auth_attempts, lib/attempts.ts),
 *             filterable by player (?player=<user id>) or by source (?ip=<tag>)
 *   scrapers  when each scraper last ran and whether it finished (scraper_status,
 *             written by scrape-status.js on the VPS)
 *   search    find any player or account by name, username, web id or user id
 *   signups   the newest accounts, with their bios
 *   log       the last things done from this page
 */

export const metadata: Metadata = {
  title: 'Admin - HI Maimai',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

const TZ = 'Pacific/Honolulu';
const SLOT = 'maimai-net';

const when = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toLowerCase()
    : '-';

const minutesLeft = (d: Date) => Math.max(0, Math.ceil((d.getTime() - Date.now()) / 60_000));

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type PlayerLite = { user_id: string | number; web_id: number; name: string; scores_opt_out?: boolean };
const PLAYER_FIELDS = { user_id: 1, web_id: 1, name: 1, scores_opt_out: 1 } as const;

type ScraperStatusDoc = {
  _id: string;
  state: 'running' | 'ok' | 'failed' | 'stopped';
  started_at: Date;
  finished_at?: Date;
  seconds?: number;
  args?: string;
  error?: string;
};
// a run still "running" after this long almost certainly died without saying so
const STUCK_HOURS = 3;
// a scraper that hasn't finished a run in this long has probably stopped being scheduled
const STALE_HOURS = 26;
type AccountRow = AccountDoc & { bio?: string };

const CLAIM_KINDS: AttemptKind[] = ['claim-start', 'claim-verify', 'claim-complete', 'claim-cancel'];
const KIND_LABEL: Record<AttemptKind, string> = {
  'claim-start': 'start',
  'claim-verify': 'verify',
  'claim-complete': 'finish',
  'claim-cancel': 'cancel',
  login: 'sign in',
};
// green for things that worked, blue for "still going", red for anything refused
const OUTCOME_TAG: Record<AttemptOutcome, string> = {
  ok: 'ad-tag-ok', verified: 'ad-tag-ok', created: 'ad-tag-ok', reset: 'ad-tag-ok',
  'not-yet': 'ad-tag-live',
  blocked: 'ad-tag-bad', failed: 'ad-tag-bad', error: 'ad-tag-bad',
};
const OUTCOME_LABEL: Record<AttemptOutcome, string> = {
  ok: 'ok', verified: 'verified', created: 'account made', reset: 'access reset',
  'not-yet': 'title unchanged', blocked: 'blocked', failed: 'failed', error: 'server error',
};
// "ok" says something different for each step
const OK_LABEL: Partial<Record<AttemptKind, string>> = { login: 'signed in', 'claim-start': 'started', 'claim-cancel': 'cancelled' };
const resultLabel = (a: Pick<AttemptDoc, 'kind' | 'outcome'>) =>
  (a.outcome === 'ok' && OK_LABEL[a.kind]) || OUTCOME_LABEL[a.outcome];

const css = `
  .ad-wrap { max-width: 900px; margin: 0 auto; padding: 2rem 1rem 3rem; font-family: sans-serif; }
  .ad-back { display: inline-block; font-size: 0.85rem; color: var(--text-sub); text-decoration: none; margin-bottom: 1rem; }
  .ad-back:hover { color: #2563eb; }
  .ad-wrap h1 { margin: 0 0 0.25rem; }
  .ad-intro { margin: 0 0 1.5rem; font-size: 0.85rem; color: var(--text-sub); }
  .ad-card { border: 1px solid var(--border-light); border-radius: 12px; padding: 1rem 1.1rem; margin-bottom: 1.25rem; }
  .ad-card h2 { margin: 0 0 0.75rem; font-size: 1.05rem; }
  .ad-muted { color: var(--text-sub); font-size: 0.85rem; margin: 0; }
  .ad-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem 1rem; flex-wrap: wrap; }
  .ad-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .ad-table th { text-align: left; font-size: 0.75rem; font-weight: 700; color: var(--text-sub); padding: 0 8px 6px; }
  .ad-table td { padding: 8px; border-top: 1px solid var(--border-light); vertical-align: top; }
  .ad-table a { color: #2563eb; text-decoration: none; }
  .ad-table a:hover { text-decoration: underline; }
  .ad-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  .ad-bio { max-width: 280px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-sub); }
  .ad-tag { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 700;
    background: rgba(127,127,127,0.14); color: var(--text-sub); }
  .ad-tag-live { background: rgba(37, 99, 235, 0.15); color: #2563eb; }
  .ad-tag-ok { background: rgba(34, 163, 90, 0.15); color: #22a35a; }
  .ad-tag-bad { background: rgba(225, 29, 72, 0.13); color: #e11d48; }
  .ad-ip { font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--text-sub); text-decoration: none; }
  .ad-ip:hover { color: #2563eb; }
  .ad-msg { max-width: 260px; color: var(--text-sub); font-size: 0.78rem; }
  .ad-sums { display: flex; flex-wrap: wrap; gap: 6px; margin: -0.25rem 0 0.75rem; }
  .ad-filter { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px;
    margin-bottom: 1.25rem; padding: 0.6rem 1rem; border-radius: 10px; font-size: 0.85rem;
    background: rgba(37, 99, 235, 0.1); }
  .ad-filter a { color: #2563eb; }
  .ad-search { display: flex; gap: 8px; margin-bottom: 0.75rem; }
  .ad-search input { flex: 1; min-width: 0; font: inherit; padding: 7px 10px; border-radius: 8px;
    border: 1px solid var(--border-light); background: transparent; color: inherit; }
  .ad-search input:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .ad-btn { border: 1px solid var(--border-light); border-radius: 7px; padding: 4px 10px; font: inherit; font-size: 0.78rem;
    font-weight: 700; cursor: pointer; background: transparent; color: inherit; white-space: nowrap; }
  .ad-btn:hover:not(:disabled) { background: rgba(127,127,127,0.12); }
  .ad-btn:disabled { opacity: 0.55; cursor: default; }
  .ad-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .ad-btn-danger { border-color: rgba(225, 29, 72, 0.5); color: #e11d48; }
  .ad-btn-danger:hover:not(:disabled) { background: rgba(225, 29, 72, 0.1); }
  .ad-btn-primary { background: #2563eb; border-color: #2563eb; color: #fff; }
  .ad-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
  .ad-btn-wrap { display: inline-flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .ad-btn-error { font-size: 0.72rem; color: #e11d48; }
  .ad-scroll { overflow-x: auto; }
  @media (max-width: 600px) {
    .ad-hide-sm { display: none; }
  }
`;

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ q?: string; player?: string; ip?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) notFound();

  const { q: rawQuery, player: playerParam, ip: ipParam } = await searchParams;
  const q = (rawQuery ?? '').trim().slice(0, 60);
  // narrowing the attempts tables to one player or one source
  const filterPlayer = /^\d{5,20}$/.test(playerParam ?? '') ? playerParam! : null;
  const filterIp = /^[0-9a-f]{10}$/.test(ipParam ?? '') ? ipParam! : null;

  const db = await getDb();
  const now = new Date();
  const players = db.collection<PlayerLite>('players');
  const accounts = db.collection<AccountRow>('accounts');

  // players' names and web ids, for a list of user ids (stored as text or number)
  const playersFor = async (ids: string[]) => {
    if (ids.length === 0) return new Map<string, PlayerLite>();
    const docs = await players
      .find({ user_id: { $in: [...ids, ...ids.map(Number)] } }, { projection: PLAYER_FIELDS })
      .toArray();
    return new Map(docs.map((p) => [String(p.user_id), p]));
  };

  // ---- claims in progress and the slot ----
  const [slot, liveClaims] = await Promise.all([
    db.collection<{ _id: string; holder: string; until: Date }>('locks').findOne({ _id: SLOT }),
    db
      .collection<ClaimDoc>('claims')
      .find({
        $or: [
          { verified_at: null, verify_until: { $gt: now } },
          { verified_at: { $ne: null }, setup_until: { $gt: now } },
        ],
      })
      .sort({ started_at: -1 })
      .toArray(),
  ]);
  const liveSlot = slot && slot.until > now ? slot : null;
  const slotClaim = liveSlot ? liveClaims.find((c) => c._id === liveSlot.holder) : null;

  // ---- newest accounts ----
  const recent = await accounts
    .find({}, { projection: { password_hash: 0 } })
    .sort({ created_at: -1 })
    .limit(30)
    .toArray();
  const totalAccounts = await accounts.estimatedDocumentCount();

  // ---- search ----
  let results: Array<{ player: PlayerLite | null; account: AccountRow | null }> = [];
  if (q) {
    let found: PlayerLite[] = [];
    if (/^\d{1,7}$/.test(q)) {
      found = await players.find({ web_id: Number(q) }, { projection: PLAYER_FIELDS }).limit(5).toArray();
    } else if (/^\d{8,20}$/.test(q)) {
      found = await players.find({ user_id: { $in: [q, Number(q)] } }, { projection: PLAYER_FIELDS }).limit(5).toArray();
    } else {
      found = await players
        .find({ name: { $regex: escapeRegex(q), $options: 'i' } }, { projection: PLAYER_FIELDS })
        .limit(20)
        .toArray();
    }
    // usernames match too, for accounts whose site name differs from their in-game one
    const byUsername = await accounts
      .find({ username_lower: { $regex: `^${escapeRegex(q.toLowerCase())}` } }, { projection: { password_hash: 0 } })
      .limit(10)
      .toArray();

    const ids = [...new Set([...found.map((p) => String(p.user_id)), ...byUsername.map((a) => a._id)])];
    const [accountDocs, playerMap] = await Promise.all([
      accounts.find({ _id: { $in: ids } }, { projection: { password_hash: 0 } }).toArray(),
      playersFor(ids),
    ]);
    const accountMap = new Map(accountDocs.map((a) => [a._id, a]));
    results = ids.map((id) => ({ player: playerMap.get(id) ?? null, account: accountMap.get(id) ?? null }));
  }

  // ---- log, scrapers ----
  const [log, scrapers] = await Promise.all([
    db.collection<AdminLogDoc>('admin_log').find().sort({ at: -1 }).limit(25).toArray(),
    db.collection<ScraperStatusDoc>('scraper_status').find().sort({ _id: 1 }).toArray(),
  ]);

  // ---- claim and sign-in attempts ----
  const attemptsCol = db.collection<AttemptDoc>('auth_attempts');
  const attemptFilter = {
    ...(filterPlayer ? { user_id: filterPlayer } : {}),
    ...(filterIp ? { ip_hash: filterIp } : {}),
  };
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [claimAttempts, loginAttempts, daySums] = await Promise.all([
    attemptsCol.find({ ...attemptFilter, kind: { $in: CLAIM_KINDS } }).sort({ at: -1 }).limit(40).toArray(),
    attemptsCol.find({ ...attemptFilter, kind: 'login' }).sort({ at: -1 }).limit(40).toArray(),
    attemptsCol
      .aggregate<{ _id: { login: boolean; outcome: AttemptOutcome }; n: number }>([
        { $match: { ...attemptFilter, at: { $gte: dayAgo } } },
        { $group: { _id: { login: { $eq: ['$kind', 'login'] }, outcome: '$outcome' }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ])
      .toArray(),
  ]);
  const sumsFor = (login: boolean) => daySums.filter((d) => d._id.login === login);

  const nameMap = await playersFor([
    ...recent.map((a) => a._id),
    ...liveClaims.map((c) => c.user_id),
    ...log.map((l) => l.target_user_id).filter((id): id is string => Boolean(id)),
    ...[...claimAttempts, ...loginAttempts].map((a) => a.user_id).filter((id): id is string => Boolean(id)),
    ...(filterPlayer ? [filterPlayer] : []),
  ]);
  const playerName = (id: string | null | undefined) => {
    const p = id ? nameMap.get(id) : null;
    return p ? toNormalWidth(p.name) : '(unknown player)';
  };
  const profileLink = (id: string, label?: string) => {
    const p = nameMap.get(id);
    return p ? <Link href={`/user/${p.web_id}`}>{label ?? toNormalWidth(p.name)}</Link> : (label ?? '(unknown player)');
  };

  // the action buttons for one player and/or their account
  const rowActions = (userId: string, account: AccountRow | null, player: PlayerLite | null | undefined) => {
    const who = account?.username ?? (player ? toNormalWidth(player.name) : 'this player');
    return (
      <div className="ad-actions">
        {account?.bio && (
          <AdminButton action="clear-bio" userId={userId} label="clear bio"
            confirmText={`clear ${who}'s bio? the old text is saved in the admin log`} />
        )}
        {player && (player.scores_opt_out ? (
          <AdminButton action="show-scores" userId={userId} label="show scores"
            confirmText={`show ${who}'s scores again? only do this if they asked`} />
        ) : (
          <AdminButton action="hide-scores" userId={userId} label="hide scores"
            confirmText={`hide ${who}'s best 50 and play stats from their profile?`} />
        ))}
        {account && (
          <AdminButton action="sign-out" userId={userId} label="sign out"
            confirmText={`sign ${who} out on every device? their account and password stay the same`} />
        )}
        {account && userId !== admin.userId && (
          <AdminButton action="unclaim" userId={userId} label="unclaim" danger
            confirmText={`unclaim ${who}? this deletes their account and signs them out. their profile and scores stay, and it can be claimed again`} />
        )}
      </div>
    );
  };

  // one attempts table: claims show the profile, sign-ins show what was typed
  const attemptsTable = (rows: AttemptDoc[], login: boolean) => (
    <div className="ad-scroll">
      <table className="ad-table">
        <thead>
          <tr>
            <th>when</th>
            {!login && <th>step</th>}
            <th>{login ? 'username typed' : 'profile'}</th>
            <th>result</th>
            <th className="ad-hide-sm">message</th>
            <th>from</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={String((a as AttemptDoc & { _id: unknown })._id)}>
              <td>{when(a.at)}</td>
              {!login && <td>{KIND_LABEL[a.kind]}</td>}
              <td>
                {login ? (
                  <>
                    <b>{a.username ?? '-'}</b>
                    {a.user_id
                      ? <div><Link className="ad-ip" href={`/admin?player=${a.user_id}#attempts`}>{playerName(a.user_id)}</Link></div>
                      : a.username && <div className="ad-muted" style={{ fontSize: '0.72rem' }}>no such account</div>}
                  </>
                ) : a.user_id ? (
                  <Link href={`/admin?player=${a.user_id}#attempts`}>{playerName(a.user_id)}</Link>
                ) : (
                  <span className="ad-muted">{a.web_id != null ? `web ${a.web_id}` : '-'}</span>
                )}
                {!login && a.kind === 'claim-complete' && a.username && (
                  <div className="ad-muted" style={{ fontSize: '0.72rem' }}>as {a.username}</div>
                )}
              </td>
              <td><span className={`ad-tag ${OUTCOME_TAG[a.outcome]}`}>{resultLabel(a)}</span></td>
              <td className="ad-hide-sm"><div className="ad-msg">{a.message ?? ''}</div></td>
              <td><Link className="ad-ip" href={`/admin?ip=${a.ip_hash}#attempts`} title="everything from this source">{a.ip_hash}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // "24h: 5 account made · 2 blocked ..."
  const daySummary = (login: boolean) => {
    const sums = sumsFor(login);
    return sums.length === 0 ? (
      <span className="ad-muted">nothing in the last 24h</span>
    ) : (
      <>
        <span className="ad-muted">last 24h:</span>
        {sums.map((d) => (
          <span key={d._id.outcome} className={`ad-tag ${OUTCOME_TAG[d._id.outcome]}`}>{d.n} {d._id.outcome === 'ok' && login ? 'signed in' : OUTCOME_LABEL[d._id.outcome]}</span>
        ))}
      </>
    );
  };

  const hoursSince = (d: Date | undefined) => (d ? (Date.now() - new Date(d).getTime()) / 3_600_000 : Infinity);
  const duration = (sec: number | undefined) =>
    sec == null ? '-' : sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`;

  return (
    <main className="ad-wrap">
      <style>{css}</style>
      <Link href="/" className="ad-back">← back to leaderboard</Link>
      <h1>admin</h1>
      <p className="ad-intro">signed in as <b>{admin.username}</b>. everything done here is written to the log at the bottom</p>

      {/* ---------------- claims ---------------- */}
      <section className="ad-card">
        <div className="ad-row">
          <h2>claims</h2>
          {liveSlot ? (
            <span className="ad-tag ad-tag-live">slot taken · frees in {minutesLeft(liveSlot.until)} min</span>
          ) : (
            <span className="ad-tag ad-tag-ok">slot free</span>
          )}
        </div>

        {liveSlot && (
          <div className="ad-row" style={{ marginBottom: '0.75rem' }}>
            <p className="ad-muted">
              held by {slotClaim ? <>a claim on {profileLink(slotClaim.user_id)}</> : 'a claim that no longer exists'} until {when(liveSlot.until)}
            </p>
            <AdminButton action="free-slot" label="free the slot" danger
              confirmText="free the slot? if that claim is still running, its next verify press may clash with another claim's" />
          </div>
        )}

        {liveClaims.length === 0 ? (
          <p className="ad-muted">no claims in progress</p>
        ) : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead>
                <tr><th>profile</th><th>status</th><th className="ad-hide-sm">started</th><th>checks</th><th /></tr>
              </thead>
              <tbody>
                {liveClaims.map((c) => (
                  <tr key={c._id}>
                    <td>{profileLink(c.user_id)}</td>
                    <td>
                      {c.verified_at
                        ? <span className="ad-tag ad-tag-ok">verified · picking a password</span>
                        : <span className="ad-tag ad-tag-live">verifying · {minutesLeft(c.verify_until)} min left</span>}
                    </td>
                    <td className="ad-hide-sm">{when(c.started_at)}</td>
                    <td>{c.checks}</td>
                    <td>
                      <div className="ad-actions">
                        <AdminButton action="cancel-claim" claimId={c._id} label="cancel" danger
                          confirmText={`cancel the claim on ${playerName(c.user_id)}? they'll have to start over`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------- attempts ---------------- */}
      <div id="attempts" />
      {(filterPlayer || filterIp) && (
        <div className="ad-filter">
          <span>
            showing attempts {filterPlayer ? <>for <b>{playerName(filterPlayer)}</b></> : null}
            {filterPlayer && filterIp ? ' ' : ''}
            {filterIp ? <>from <code>{filterIp}</code></> : null} only
          </span>
          <Link href="/admin#attempts">show everyone</Link>
        </div>
      )}

      <section className="ad-card">
        <h2>claim attempts</h2>
        <div className="ad-sums">{daySummary(false)}</div>
        {claimAttempts.length === 0 ? <p className="ad-muted">none recorded yet</p> : attemptsTable(claimAttempts, false)}
      </section>

      <section className="ad-card">
        <h2>sign-in attempts</h2>
        <div className="ad-sums">{daySummary(true)}</div>
        {loginAttempts.length === 0 ? <p className="ad-muted">none recorded yet</p> : attemptsTable(loginAttempts, true)}
      </section>

      {/* ---------------- scrapers ---------------- */}
      <section className="ad-card">
        <h2>scrapers</h2>
        {scrapers.length === 0 ? (
          <p className="ad-muted">no runs recorded yet. scrape-status.js on the VPS writes these once the scrapers use it</p>
        ) : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead>
                <tr><th>scraper</th><th>last run</th><th>started</th><th className="ad-hide-sm">took</th><th className="ad-hide-sm">args</th></tr>
              </thead>
              <tbody>
                {scrapers.map((sc) => {
                  const stuck = sc.state === 'running' && hoursSince(sc.started_at) > STUCK_HOURS;
                  const stale = sc.state !== 'running' && hoursSince(sc.finished_at ?? sc.started_at) > STALE_HOURS;
                  return (
                    <tr key={sc._id}>
                      <td><b>{sc._id}</b></td>
                      <td>
                        {stuck ? <span className="ad-tag ad-tag-bad">running {Math.floor(hoursSince(sc.started_at))}h · probably crashed</span>
                          : sc.state === 'running' ? <span className="ad-tag ad-tag-live">running now</span>
                          : sc.state === 'ok' ? <span className="ad-tag ad-tag-ok">finished</span>
                          : <span className="ad-tag ad-tag-bad">{sc.state}</span>}
                        {stale && <div className="ad-muted" style={{ fontSize: '0.72rem', color: '#e11d48' }}>no run in over a day</div>}
                        {sc.error && <div className="ad-muted" style={{ fontSize: '0.72rem' }}>{sc.error}</div>}
                      </td>
                      <td>{when(sc.started_at)}</td>
                      <td className="ad-hide-sm">{sc.state === 'running' ? '-' : duration(sc.seconds)}</td>
                      <td className="ad-hide-sm"><code style={{ fontSize: '0.75rem' }}>{sc.args || '-'}</code></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------- search ---------------- */}
      <section className="ad-card">
        <h2>find a player</h2>
        <form className="ad-search" action="/admin">
          <input name="q" defaultValue={q} placeholder="in-game name, site username, web id or user id" aria-label="search" />
          <button type="submit" className="ad-btn ad-btn-primary">search</button>
        </form>
        {q && (results.length === 0 ? (
          <p className="ad-muted">nothing matched “{q}”</p>
        ) : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead>
                <tr><th>player</th><th>account</th><th className="ad-hide-sm">bio</th><th /></tr>
              </thead>
              <tbody>
                {results.map(({ player, account }) => (
                  <tr key={String(player?.user_id ?? account?._id)}>
                    <td>
                      {player ? <Link href={`/user/${player.web_id}`}>{toNormalWidth(player.name)}</Link> : '(no profile)'}
                      <div className="ad-muted" style={{ fontSize: '0.72rem' }}>
                        {player ? `web ${player.web_id} · ` : ''}{String(player?.user_id ?? account?._id)}
                      </div>
                      {player?.scores_opt_out && <span className="ad-tag">scores hidden</span>}
                    </td>
                    <td>
                      {account
                        ? <><b>{account.username}</b><div className="ad-muted" style={{ fontSize: '0.72rem' }}>since {when(account.created_at)}</div></>
                        : <span className="ad-tag">unclaimed</span>}
                    </td>
                    <td className="ad-hide-sm"><div className="ad-bio">{account?.bio ?? ''}</div></td>
                    <td>{rowActions(String(player?.user_id ?? account?._id), account, player)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {/* ---------------- signups ---------------- */}
      <section className="ad-card">
        <div className="ad-row">
          <h2>recent signups</h2>
          <span className="ad-muted">{totalAccounts.toLocaleString('en-US')} account{totalAccounts === 1 ? '' : 's'} in total</span>
        </div>
        {recent.length === 0 ? (
          <p className="ad-muted">no accounts yet</p>
        ) : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead>
                <tr><th>username</th><th>profile</th><th className="ad-hide-sm">joined</th><th className="ad-hide-sm">bio</th><th /></tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a._id}>
                    <td><b>{a.username}</b></td>
                    <td>{profileLink(a._id)}</td>
                    <td className="ad-hide-sm">{when(a.created_at)}</td>
                    <td className="ad-hide-sm"><div className="ad-bio">{a.bio ?? ''}</div></td>
                    <td>{rowActions(a._id, a, nameMap.get(a._id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------- log ---------------- */}
      <section className="ad-card">
        <h2>admin log</h2>
        {log.length === 0 ? (
          <p className="ad-muted">nothing yet</p>
        ) : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead>
                <tr><th>when</th><th>who</th><th>what</th><th>player</th></tr>
              </thead>
              <tbody>
                {log.map((l) => (
                  <tr key={String(l._id)}>
                    <td>{when(l.at)}</td>
                    <td>{l.admin_username}</td>
                    <td>{l.action}{typeof l.details?.username === 'string' ? ` (${l.details.username})` : ''}</td>
                    <td>{l.target_user_id ? playerName(l.target_user_id) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}