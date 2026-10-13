'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { announceAuthChange } from './AccountButton';
import LoadingDots from './LoadingDots';
import { USERNAME_CHANGE_DAYS } from '../lib/account-settings';
import { useScoreRefresh } from './RefreshScores';

/**
 * The settings page's sections (/settings): username, password, show my scores, and sign
 * out everywhere. Each talks to its own route (/api/account/..., and
 * /api/profile/scores-visibility for the scores switch) and says how it went under itself.
 */

const css = `
  .st-card { margin: 0 0 1.25rem; padding: 1.25rem 1.5rem 1.35rem; border: 1px solid var(--border-light); border-radius: 12px; }
  .st-card h2 { margin: 0 0 0.35rem; font-size: 1.05rem; }
  .st-sub { margin: 0 0 0.75rem; font-size: 0.82rem; color: var(--text-sub); line-height: 1.45; }
  .st-sub b { color: inherit; }
  .st-sub-gap { margin-top: 1rem; padding-top: 0.9rem; border-top: 1px solid var(--border-light); }
  .st-field { display: flex; flex-direction: column; gap: 3px; margin-bottom: 0.6rem; }
  .st-field label { font-size: 0.78rem; font-weight: 700; color: var(--text-sub); }
  .st-field input { font: inherit; padding: 7px 10px; border-radius: 7px; border: 1px solid var(--border-light);
    background: transparent; color: inherit; }
  .st-field input:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .st-hint { font-size: 0.72rem; color: var(--text-muted); }
  .st-row { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 0.4rem; }
  .st-btn { border: 0; border-radius: 8px; padding: 7px 16px; font: inherit; font-weight: 700; cursor: pointer;
    background: #2563eb; color: #fff; }
  .st-btn:hover:not(:disabled) { background: #1d4ed8; }
  .st-btn:disabled { opacity: 0.55; cursor: default; }
  .st-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .st-btn-quiet { background: rgba(127,127,127,0.22); color: inherit; }
  .st-btn-quiet:hover:not(:disabled) { background: rgba(127,127,127,0.34); }
  .st-btn-danger { background: #e11d48; }
  .st-btn-danger:hover:not(:disabled) { background: #be123c; }
  .st-msg { margin: 0.5rem 0 0; padding: 6px 10px; border-radius: 7px; font-size: 0.82rem; }
  .st-err { background: rgba(225, 29, 72, 0.12); color: #e11d48; }
  .st-ok { background: rgba(34, 163, 90, 0.14); color: #22a35a; }
  .st-err-text { color: #e11d48; }
  .st-lines { white-space: pre-line; } /* a note's \n as a line break */

  /* the scores switch: same look as the one that used to be in the account menu */
  .st-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;
    padding: 9px 12px; border: 0; border-radius: 8px; background: rgba(127,127,127,0.12); color: inherit;
    font: inherit; font-weight: 700; cursor: pointer; text-align: left; }
  .st-toggle:hover:not(:disabled) { background: rgba(127,127,127,0.2); }
  .st-toggle:disabled { opacity: 0.55; cursor: default; }
  .st-toggle:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .st-switch { position: relative; flex-shrink: 0; width: 36px; height: 20px; border-radius: 999px;
    background: rgba(127,127,127,0.45); transition: background 0.15s ease; }
  .st-toggle[aria-checked="true"] .st-switch { background: #2563eb; }
  .st-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff;
    transition: transform 0.15s ease; }
  .st-toggle[aria-checked="true"] .st-knob { transform: translateX(16px); }
  @media (prefers-reduced-motion: reduce) { .st-switch, .st-knob { transition: none; } }
`;

type Result = { ok: boolean; text: string } | null;

async function post(url: string, body?: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  return { ok: Boolean(res?.ok), data: data as Record<string, any>, offline: !res };
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const Msg = ({ result }: { result: Result }) =>
  result ? <p className={`st-msg ${result.ok ? 'st-ok' : 'st-err'}`} role="status">{result.text}</p> : null;

export default function SettingsForms({ username: initialUsername, nextUsernameChange, scoresHidden: initialHidden, jpScoresShown }: {
  username: string;
  nextUsernameChange: string | null; // when the next change is allowed, null: now
  scoresHidden: boolean;
  jpScoresShown: boolean | null; // only the player with japanese-site scores gets the switch
}) {
  const router = useRouter();

  // ----- refresh my scores: asks how it stands when the page opens -----
  const scoreRefresh = useScoreRefresh(true);

  // ----- username -----
  const [username, setUsername] = useState(initialUsername);
  const [newName, setNewName] = useState('');
  const [nextChange, setNextChange] = useState(nextUsernameChange);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameResult, setNameResult] = useState<Result>(null);
  const canRename = !nextChange || new Date(nextChange) <= new Date();

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameBusy(true); setNameResult(null);
    const { ok, data, offline } = await post('/api/account/username', { username: newName.trim() });
    setNameBusy(false);
    if (!ok) { setNameResult({ ok: false, text: offline ? "couldn't reach the site. try again" : data.error ?? 'something went wrong' }); return; }
    setUsername(data.username);
    setNewName('');
    setNextChange(new Date(new Date(data.changedAt).getTime() + USERNAME_CHANGE_DAYS * 86_400_000).toISOString());
    setNameResult({ ok: true, text: `you're now ${data.username}` });
    announceAuthChange(); // the header's account button shows the new name
    router.refresh();
  };

  // ----- password -----
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwResult, setPwResult] = useState<Result>(null);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setPwResult({ ok: false, text: "the new passwords don't match" }); return; }
    setPwBusy(true); setPwResult(null);
    const { ok, data, offline } = await post('/api/account/password', { current, password });
    setPwBusy(false);
    if (!ok) { setPwResult({ ok: false, text: offline ? "couldn't reach the site. try again" : data.error ?? 'something went wrong' }); return; }
    setCurrent(''); setPassword(''); setConfirm('');
    setPwResult({ ok: true, text: 'password changed. every other browser has been signed out' });
  };

  // ----- show my scores -----
  const [hidden, setHidden] = useState(initialHidden);
  const [scoresBusy, setScoresBusy] = useState(false);
  const [scoresResult, setScoresResult] = useState<Result>(null);

  const toggleScores = async () => {
    setScoresBusy(true); setScoresResult(null);
    const { ok, data, offline } = await post('/api/profile/scores-visibility', { hidden: !hidden });
    setScoresBusy(false);
    if (!ok) { setScoresResult({ ok: false, text: offline ? "couldn't reach the site. try again" : data.error ?? 'something went wrong' }); return; }
    setHidden(Boolean(data.hidden));
    router.refresh();
  };

  // ----- show japan scores (one player only) -----
  const [jpShown, setJpShown] = useState(jpScoresShown !== false);
  const [jpBusy, setJpBusy] = useState(false);
  const [jpResult, setJpResult] = useState<Result>(null);

  const toggleJp = async () => {
    setJpBusy(true); setJpResult(null);
    const { ok, data, offline } = await post('/api/profile/jp-scores', { shown: !jpShown });
    setJpBusy(false);
    if (!ok) { setJpResult({ ok: false, text: offline ? "couldn't reach the site. try again" : data.error ?? 'something went wrong' }); return; }
    setJpShown(Boolean(data.shown));
    router.refresh();
  };

  // ----- sign out (this browser), same as the account menu's -----
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setSigningOut(false);
    announceAuthChange();
    router.push('/');
  };

  // ----- sign out everywhere -----
  const [allBusy, setAllBusy] = useState(false);
  const [allResult, setAllResult] = useState<Result>(null);

  const signOutEverywhere = async () => {
    if (!window.confirm('sign out of every browser and device, including this one?')) return;
    setAllBusy(true); setAllResult(null);
    const { ok, offline } = await post('/api/account/sign-out-all');
    setAllBusy(false);
    if (!ok) { setAllResult({ ok: false, text: offline ? "couldn't reach the site. try again" : 'something went wrong' }); return; }
    announceAuthChange();
    router.push('/');
  };

  return (
    <>
      <style>{css}</style>

      {/* scores hidden: nothing to refresh */}
      {!hidden && (
        <section className="st-card" aria-labelledby="st-refresh">
          <h2 id="st-refresh">refresh my scores</h2>
          {scoreRefresh.note && (
            <p className={`st-sub st-lines${scoreRefresh.error ? ' st-err-text' : ''}`} role="status">{scoreRefresh.note}</p>
          )}
          <div className="st-row">
            <button type="button" className="st-btn" onClick={scoreRefresh.refresh}
              disabled={scoreRefresh.sending || !scoreRefresh.canRefresh}>
              {scoreRefresh.sending ? <LoadingDots label="asking" />
                : scoreRefresh.inProgress ? <LoadingDots label="refreshing" />
                : `↻ ${scoreRefresh.label}`}
            </button>
          </div>
        </section>
      )}

      <section className="st-card" aria-labelledby="st-username">
        <h2 id="st-username">username</h2>
        <p className="st-sub">
          your current username is <b>{username}</b>. you can change it once every {USERNAME_CHANGE_DAYS} days
          {!canRename && nextChange && <>. next change: <b>{formatDate(nextChange)}</b></>}
        </p>
        <form onSubmit={rename}>
          <div className="st-field">
            <label htmlFor="st-new-name">new username</label>
            <input id="st-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={!canRename}
              autoComplete="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_.\-]+" />
            <span className="st-hint">3 to 20 characters: letters, numbers, _ . or -</span>
          </div>
          <div className="st-row">
            <button type="submit" className="st-btn" disabled={!canRename || nameBusy}>
              {nameBusy ? <LoadingDots label="saving" /> : 'change username'}
            </button>
          </div>
        </form>
        <Msg result={nameResult} />
      </section>

      <section className="st-card" aria-labelledby="st-password">
        <h2 id="st-password">password</h2>
        <p className="st-sub">changing your password signs you out everywhere else</p>
        <form onSubmit={changePassword}>
          {/* the username, so password managers know which account this is for */}
          <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />
          <div className="st-field">
            <label htmlFor="st-current">current password</label>
            <input id="st-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password" required />
          </div>
          <div className="st-field">
            <label htmlFor="st-new">new password</label>
            <input id="st-new" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password" required minLength={8} />
            <span className="st-hint">at least 8 characters</span>
          </div>
          <div className="st-field">
            <label htmlFor="st-confirm">new password again</label>
            <input id="st-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password" required minLength={8} />
          </div>
          <div className="st-row">
            <button type="submit" className="st-btn" disabled={pwBusy}>
              {pwBusy ? <LoadingDots label="saving" /> : 'change password'}
            </button>
          </div>
        </form>
        <Msg result={pwResult} />
      </section>

      <section className="st-card" aria-labelledby="st-scores">
        <h2 id="st-scores">scores</h2>
        <button type="button" className="st-toggle" role="switch" aria-checked={!hidden} onClick={toggleScores} disabled={scoresBusy}>
          show my scores
          <span className="st-switch" aria-hidden="true"><span className="st-knob" /></span>
        </button>
        <p className="st-sub" style={{ margin: '0.5rem 0 0' }}>
          {hidden
            ? 'your best 50, play stats and favorites are hidden from your profile'
            : 'turn off to hide your best 50, play stats and favorites from your profile'}
        </p>
        <Msg result={scoresResult} />

        {/* her japanese-site scores on her profile or not (nothing to show while her scores are hidden) */}
        {jpScoresShown != null && (
          <>
            <button type="button" className="st-toggle" role="switch" aria-checked={jpShown} onClick={toggleJp}
              disabled={jpBusy || hidden} style={{ marginTop: '0.9rem' }}>
              show japan scores
              <span className="st-switch" aria-hidden="true"><span className="st-knob" /></span>
            </button>
            <p className="st-sub" style={{ margin: '0.5rem 0 0' }}>
              {hidden
                ? 'your scores are hidden, so these are too'
                : jpShown
                  ? 'your profile uses your best score from either version'
                  : 'turn on to add your japan scores to your profile'}
            </p>
            <Msg result={jpResult} />
          </>
        )}
      </section>

      <section className="st-card" aria-labelledby="st-sessions">
        <h2 id="st-sessions">sessions</h2>
        <p className="st-sub">signs you out on this browser</p>
        <div className="st-row">
          <button type="button" className="st-btn st-btn-quiet" onClick={signOut} disabled={signingOut || allBusy}>
            {signingOut ? <LoadingDots label="signing out" /> : 'sign out'}
          </button>
        </div>
        <p className="st-sub st-sub-gap">signs you out on every browser and device</p>
        <div className="st-row">
          <button type="button" className="st-btn st-btn-danger" onClick={signOutEverywhere} disabled={allBusy}>
            {allBusy ? <LoadingDots label="signing out" /> : 'sign out of all sessions'}
          </button>
        </div>
        <Msg result={allResult} />
      </section>
    </>
  );
}
