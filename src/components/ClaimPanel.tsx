'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { announceAuthChange } from './AccountButton';

/**
 * The claim strip under a profile's header, and the whole claim flow:
 *
 *   intro   -> how it works, captcha, "Start"
 *   verify  -> "change your title, then press Verify", with a countdown
 *   setup   -> pick a username and password (pre-filled on a reclaim)
 *
 * The profile page decides which strip to show: the owner sees "this is you",
 * a claimed profile offers "sign in", an unclaimed one offers "claim".
 *
 * Reset access (forgot password) is deliberately not on the profile itself. It
 * lives on the sign-in page: a claimed profile's "sign in" link goes to
 * /login?profile=<web_id>, whose "forgot your password?" link comes back here
 * with ?reset=1, which opens the reset flow.
 */

type Step = 'closed' | 'intro' | 'verify' | 'setup';

declare global {
    interface Window {
        turnstile?: {
            render: (el: HTMLElement, opts: Record<string, unknown>) => string;
            remove: (id: string) => void;
            reset: (id: string) => void;
        };
    }
}

const css = `
    .cp-strip { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px 12px;
    width: fit-content; max-width: 100%; box-sizing: border-box; margin: 0.25rem auto 1.5rem;
    padding: 0.6rem 1.1rem; border-radius: 12px; border: 1px solid var(--border-light);
    background: rgba(127, 127, 127, 0.06);
    font-size: 0.82rem; color: var(--text-sub); text-align: center; }
  .cp-strip b { color: inherit; }
  .cp-link { border: 0; background: none; padding: 0; font: inherit; color: #2563eb; cursor: pointer;
    text-decoration: underline; text-underline-offset: 2px; }
  .cp-link:hover { color: #1d4ed8; }
  /* pill on top, the "is this you?" line under it */
  .cp-strip-stack { flex-direction: column; gap: 6px; }
  .cp-pill { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 999px;
    background: var(--faq-highlight-bg); font-weight: 700; color: var(--text-sub); }
  .cp-uc-pill { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 999px;
    background: var(--btn-border); font-weight: 700; color: var(--text-sub); }

  .cp-card { max-width: 460px; margin: 0.25rem auto 1.75rem; padding: 1.1rem 1.25rem; border-radius: 12px;
    border: 1px solid rgba(37, 99, 235, 0.35); background: var(--faq-highlight-bg); font-size: 0.88rem; line-height: 1.55; }
  .cp-card h2 { margin: 0 0 0.5rem; font-size: 1.05rem; }
  .cp-card p { margin: 0 0 0.6rem; }
  .cp-card ol { margin: 0 0 0.75rem; padding-left: 1.2rem; }
  .cp-card li { margin: 2px 0; }
  .cp-title { font-weight: 800; }
  .cp-muted { color: var(--text-sub); font-size: 0.8rem; }
  .cp-error { margin: 0 0 0.6rem; padding: 6px 10px; border-radius: 7px; font-size: 0.82rem;
    background: rgba(225, 29, 72, 0.12); color: #e11d48; }
  .cp-ok { margin: 0 0 0.6rem; padding: 6px 10px; border-radius: 7px; font-size: 0.82rem;
    background: rgba(34, 163, 90, 0.14); color: #22a35a; }
  .cp-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 0.75rem; }
  .cp-btn { border: 0; border-radius: 8px; padding: 7px 16px; font: inherit; font-weight: 700; cursor: pointer;
    background: #2563eb; color: #fff; }
  .cp-btn:hover:not(:disabled) { background: #1d4ed8; }
  .cp-btn:disabled { opacity: 0.55; cursor: default; }
  .cp-btn-quiet { background: transparent; color: var(--text-sub); border: 1px solid var(--border-light); }
  .cp-btn-quiet:hover:not(:disabled) { background: rgba(127,127,127,0.12); }
  .cp-btn:focus-visible, .cp-link:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .cp-captcha { margin: 0.5rem 0; min-height: 65px; display: flex; justify-content: center; }

  .cp-field { display: flex; flex-direction: column; gap: 3px; margin-bottom: 0.6rem; }
  .cp-field label { font-size: 0.78rem; font-weight: 700; color: var(--text-sub); }
  .cp-field input { font: inherit; padding: 7px 10px; border-radius: 7px; border: 1px solid var(--border-light);
    background: var(--background, transparent); color: inherit; }
  .cp-field input:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .cp-hint { font-size: 0.72rem; color: var(--text-muted); }
`;

// renders a Cloudflare Turnstile widget into `boxRef` and reports its token
function useTurnstile(siteKey: string | null, active: boolean, onToken: (token: string) => void) {
    const boxRef = useRef<HTMLDivElement>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useEffect(() => {
        if (!siteKey || !active) return;
        let widgetId: string | null = null;
        let cancelled = false;

        const render = () => {
            if (cancelled || !boxRef.current || !window.turnstile) return;
            widgetId = window.turnstile.render(boxRef.current, {
                sitekey: siteKey,
                callback: (t: string) => onTokenRef.current(t),
                'expired-callback': () => onTokenRef.current(''),
                'error-callback': () => onTokenRef.current(''),
            });
        };

        if (window.turnstile) {
            render();
        } else {
            const id = 'cf-turnstile-script';
            let script = document.getElementById(id) as HTMLScriptElement | null;
            if (!script) {
                script = document.createElement('script');
                script.id = id;
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                script.async = true;
                document.head.appendChild(script);
            }
            script.addEventListener('load', render);
        }

        return () => {
            cancelled = true;
            if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
        };
    }, [siteKey, active]);

    return boxRef;
}

// "11:45 pm" in the visitor's own time zone
const localTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

// why a claim can't start right now (closed hours, or someone else is claiming), or null
type Gate = { reason: 'closed' | 'busy'; from?: string; until: string } | null;

function gateMessage(gate: NonNullable<Gate>) {
    if (gate.reason === 'busy') {
        const minutes = Math.max(1, Math.ceil((Date.parse(gate.until) - Date.now()) / 60_000));
        return `someone else is claiming a profile right now. only one claim can run at a time, so try again in ${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    const started = gate.from && Date.parse(gate.from) <= Date.now();
    return started
        ? `claims are paused while the site updates scores. try again after ${localTime(gate.until)}`
        : `claims pause at ${localTime(gate.from!)} while the site updates scores, which is too soon to finish one. try again after ${localTime(gate.until)}`;
}

async function post(url: string, body?: object) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data: data as Record<string, any> };
}

export default function ClaimPanel({ webId, playerName, claimed, isOwner, signedInAs, captchaSiteKey }: {
    webId: number;
    playerName: string;
    claimed: boolean; // someone already has an account for this profile
    isOwner: boolean; // the signed-in visitor owns this profile
    signedInAs: string | null;
    captchaSiteKey: string | null;
}) {
    const router = useRouter();
    const [step, setStep] = useState<Step>('closed');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const [gate, setGate] = useState<Gate>(null);

    // intro
    const [captchaToken, setCaptchaToken] = useState('');
    const captchaBox = useTurnstile(captchaSiteKey, step === 'intro', setCaptchaToken);

    // verify
    const [startTitle, setStartTitle] = useState<string | null>(null);
    const [verifyUntil, setVerifyUntil] = useState<number>(0);
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (step !== 'verify') return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [step]);
    const secondsLeft = Math.max(0, Math.round((verifyUntil - now) / 1000));

    // setup
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [isReclaim, setIsReclaim] = useState(false);

    // asks the server whether a claim could start right now
    const checkGate = async () => {
        const res = await fetch('/api/claim/status', { cache: 'no-store' }).catch(() => null);
        const data = res ? await res.json().catch(() => null) : null;
        setGate(data && !data.open ? { reason: data.reason, from: data.from, until: data.until } : null);
    };

    const open = () => { setError(null); setNote(null); setGate(null); setStep('intro'); void checkGate(); };

    // arriving from the sign-in page's "forgot your password?" link opens the reset flow
    useEffect(() => {
        if (!claimed || isOwner || signedInAs) return;
        const url = new URL(window.location.href);
        if (url.searchParams.get('reset') !== '1') return;
        url.searchParams.delete('reset');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
        open();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claimed, isOwner, signedInAs]);
    const close = () => { setError(null); setNote(null); setStep('closed'); };

    // cancelling mid-claim gives the slot back so the next person doesn't wait on us
    const cancelClaim = () => { void post('/api/claim/cancel'); close(); };

    const start = async () => {
        setBusy(true); setError(null);
        const { ok, data } = await post('/api/claim/start', { webId, captchaToken });
        setBusy(false);
        if (!ok) {
            setCaptchaToken('');
            // closed hours or someone else claiming: show it the same way the pre-check does
            if (data.busyUntil) { setGate({ reason: 'busy', until: data.busyUntil }); setError(null); return; }
            if (data.closedUntil) { void checkGate(); setError(data.error ?? null); return; }
            setError(data.error ?? 'something went wrong');
            return;
        }
        setStartTitle(data.currentTitle ?? null);
        setVerifyUntil(Date.parse(data.verifyUntil));
        setNow(Date.now());
        setStep('verify');
    };

    const verify = async () => {
        setBusy(true); setError(null); setNote(null);
        const { ok, data } = await post('/api/claim/verify');
        setBusy(false);
        if (!ok) { setError(data.error ?? 'something went wrong'); return; }
        if (!data.verified) {
            setNote(`your title still reads "${data.currentTitle ?? '(none)'}". change it, wait a moment, then try again`);
            return;
        }
        setUsername(data.suggestedUsername ?? '');
        setIsReclaim(Boolean(data.existingUsername));
        setStep('setup');
    };

    const complete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) { setError("the passwords don't match"); return; }
        setBusy(true); setError(null);
        const { ok, data } = await post('/api/claim/complete', { username, password });
        setBusy(false);
        if (!ok) { setError(data.error ?? 'something went wrong'); return; }
        setStep('closed');
        announceAuthChange();
        router.refresh(); // re-render the profile as its owner
    };

    const signOut = async () => {
        await post('/api/auth/logout');
        announceAuthChange();
        router.refresh();
    };

    // ----- the strip under the header -----
    if (step === 'closed') {
        // signed in on someone else's profile: they already have their one account,
        // so there's nothing to claim or sign in to here
        if (signedInAs && !isOwner) return null;

        return (
            <div className="cp-strip cp-strip-stack">
                <style>{css}</style>
                {isOwner ? (
                    <>
                        <span className="cp-pill">✓ this is you</span>
                        <span>
                            signed in as <b>{signedInAs}</b> · <button type="button" className="cp-link" onClick={signOut}>sign out</button>
                        </span>
                    </>
                ) : claimed ? (
                    <span className="cp-pill">✓ claimed profile</span>
                ) : (
                    <>
                        <span className="cp-uc-pill">unclaimed profile</span>
                        <span>is this you? · <button type="button" className="cp-link" onClick={open}>claim this profile</button></span>
                    </>
                )}
            </div>
        );
    }

    // ----- the flow -----
    return (
        <section className="cp-card" aria-live="polite">
            <style>{css}</style>

            {step === 'intro' && (
                <>
                    <h2>{claimed ? 'reset access' : 'claim profile'}</h2>
                    <p>claiming your profile will let you create an account that you can sign in with. by creating an account, you'll be able to edit your profile's bio, pinned scores, favorite charts, and more!</p>
                    <p>in order to claim your profile, we first need to prove that <b>{`${playerName}`}</b> is your maimai account. to do this, you'll need to temporarily change your <b>user title</b> on the maimai site, but don't change it just yet</p>
                    <p>first, press <b>start</b> below to begin</p>
                    {claimed && (
                        <p className="cp-muted">this replaces the current password and signs you out everywhere else</p>
                    )}
                    {gate && <p className="cp-error">{gateMessage(gate)}</p>}
                    {captchaSiteKey && <div className="cp-captcha" ref={captchaBox} />}
                    {error && !gate && <p className="cp-error">{error}</p>}
                    <div className="cp-actions">
                        <button type="button" className="cp-btn cp-btn-quiet" onClick={close}>cancel</button>
                        {gate && (
                            <button type="button" className="cp-btn cp-btn-quiet" onClick={() => void checkGate()}>check again</button>
                        )}
                        <button type="button" className="cp-btn" onClick={start}
                            disabled={busy || Boolean(gate) || (Boolean(captchaSiteKey) && !captchaToken)}>
                            {busy ? 'checking…' : 'start'}
                        </button>
                    </div>
                </>
            )}

            {step === 'verify' && (
                <>
                    <h2>now, please change your title</h2>
                    <p>your title is currently <span className="cp-title">{startTitle ?? '(none)'}</span></p>
                    <ol>
                        <li>navigate to the <Link href="https://maimaidx-eng.com/" target="_blank" rel="noopener noreferrer">maimai website</Link> and login to your maimai account</li>
                        <li>click on the "collection" button, then go to "title" <Link href="https://maimaidx-eng.com/maimai-mobile/collection/trophy/" target="_blank" rel="noopener noreferrer">(or click here)</Link></li>
                        <li>set your title to any different title</li>
                        <li>within 5 minutes, come back to this site and hit <b>"verify"</b></li>
                    </ol>
                    <p className="cp-muted">
                        {secondsLeft > 0
                            ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} left`
                            : 'time ran out. start again'}
                    </p>
                    {note && <p className="cp-error">{note}</p>}
                    {error && <p className="cp-error">{error}</p>}
                    <div className="cp-actions">
                        <button type="button" className="cp-btn cp-btn-quiet" onClick={secondsLeft > 0 ? cancelClaim : open}>
                            {secondsLeft > 0 ? 'cancel' : 'start again'}
                        </button>
                        <button type="button" className="cp-btn" onClick={verify} disabled={busy || secondsLeft === 0}>
                            {busy ? 'checking...' : 'verify'}
                        </button>
                    </div>
                </>
            )}

            {step === 'setup' && (
                <form onSubmit={complete}>
                    <h2>verified! {isReclaim ? 'set a new password' : 'make your account'}</h2>
                    <p className="cp-ok">this is your profile. you can change your title back now</p>
                    <div className="cp-field">
                        <label htmlFor="cp-username">username</label>
                        <input id="cp-username" value={username} onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_.\-]+" />
                        <span className="cp-hint">3 to 20 characters: letters, numbers, _ . or -</span>
                    </div>
                    <div className="cp-field">
                        <label htmlFor="cp-password">password</label>
                        <input id="cp-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password" required minLength={8} />
                        <span className="cp-hint">at least 8 characters</span>
                    </div>
                    <div className="cp-field">
                        <label htmlFor="cp-confirm">confirm password</label>
                        <input id="cp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                            autoComplete="new-password" required minLength={8} />
                    </div>
                    {error && <p className="cp-error">{error}</p>}
                    <div className="cp-actions">
                        <button type="submit" className="cp-btn" disabled={busy}>
                            {busy ? 'saving…' : 'save and sign in'}
                        </button>
                    </div>
                </form>
            )}
        </section>
    );
}