'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { announceAuthChange } from './AccountButton';
import LoadingDots from './LoadingDots';

/**
 * The claim strip under a profile's header, and the whole claim flow:
 *
 *   intro   -> how it works, captcha, "Start"
 *   verify  -> "change your title, then press Verify", with a countdown
 *   setup   -> pick a username and password (pre-filled on a reclaim)
 *
 * On a profile it sits in the header, under the name, as one small status line:
 * the owner sees "this is you", a claimed profile just says so, an unclaimed one
 * offers "claim". The flow's card is bigger, so it renders into the page's
 * `flowSlotId` element instead (below the header), when there is one.
 *
 * Reset access (forgot password) is deliberately not on profiles, so nobody sees a
 * reset button on other people's pages. It lives at /login/reset, which finds the
 * player's profile and renders this panel with `standalone`: it opens straight to
 * the intro, "cancel" goes back to closeHref, and finishing goes to the profile.
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
  /* the status line under the player's name */
  .cp-status { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin: 0.4rem 0 0;
    font-size: 0.75rem; color: var(--text-sub); }
  .cp-status b { color: inherit; }
  .cp-link { border: 0; background: none; padding: 0; font: inherit; color: #2563eb; cursor: pointer;
    text-decoration: underline; text-underline-offset: 2px; }
  .cp-link:hover { color: #1d4ed8; }
  .cp-pill { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px;
    background: var(--faq-highlight-bg); font-weight: 700; color: var(--text-sub); }
  .cp-uc-pill { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px;
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
  /* the secondary buttons (cancel, check again, start again): filled gray, not just an outline */
  .cp-btn-quiet { background: rgba(127,127,127,0.22); color: inherit; }
  .cp-btn-quiet:hover:not(:disabled) { background: rgba(127,127,127,0.34); }
  .cp-btn:focus-visible, .cp-link:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .cp-captcha { margin: 0.5rem 0; min-height: 65px; display: flex; justify-content: center; }

  .cp-field { display: flex; flex-direction: column; gap: 3px; margin-bottom: 0.6rem; }
  .cp-field label { font-size: 0.78rem; font-weight: 700; color: var(--text-sub); }
  .cp-field input { font: inherit; padding: 7px 10px; border-radius: 7px; border: 1px solid var(--border-light);
    background: var(--background, transparent); color: inherit; }
  .cp-field input:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .cp-hint { font-size: 0.72rem; color: var(--text-muted); }
  /* what's going on while start or verify waits on maimai NET */
  .cp-card .cp-progress { margin: 0.9rem 0 0; font-size: 0.8rem; color: var(--text-sub); text-align: right; }
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

// why a claim can't start right now, or null. the server writes the message: someone
// else claiming, the site updating (with an estimate), or the moment before an update
type Gate = { reason: 'closed' | 'busy'; message: string } | null;

// while a claim can't start, check again this often, so start comes back by itself
const GATE_RECHECK_MS = 30_000;

/*
 * Start and verify both have the VPS log in to maimai NET and look the player up on
 * the friends list, which takes a few seconds to half a minute. While that runs, a
 * line under the buttons says what's happening, and changes the longer it takes,
 * so a slow lookup doesn't look stuck. [seconds waited, message], latest first
 */
const PROGRESS: Record<'start' | 'verify', Array<[number, string]>> = {
    start: [
        [30, 'still going, sorry for the wait!'],
        [12, 'still looking, this can take up to a minute'],
        [0, 'finding your profile'],
    ],
    verify: [
        [30, 'still going, sorry for the wait!'],
        [8, 'still checking, this can take up to a minute'],
        [0, 'reading your title'],
    ],
};

// seconds since `since` (or null), ticking once a second
function useSecondsSince(since: number | null) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (since == null) return;
        setNow(Date.now());
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [since]);
    return since == null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

async function post(url: string, body?: object) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    }).catch(() => null);
    // never got an answer (offline, connection dropped): an error, not a button stuck on "checking"
    if (!res) return { ok: false, data: { error: "couldn't reach the site. check your connection and try again" } as Record<string, any> };
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data: data as Record<string, any> };
}

export default function ClaimPanel({ webId, playerName, claimed, isOwner, signedInAs, captchaSiteKey, standalone = null, flowSlotId = null }: {
    webId: number;
    playerName: string;
    claimed: boolean; // someone already has an account for this profile
    isOwner: boolean; // the signed-in visitor owns this profile
    signedInAs: string | null;
    captchaSiteKey: string | null;
    // on its own page (the reset page) instead of under a profile: no strip, and
    // cancel leaves for closeHref
    standalone?: { closeHref: string } | null;
    // id of an element elsewhere on the page that the open flow renders into
    flowSlotId?: string | null;
}) {
    const router = useRouter();
    const [step, setStep] = useState<Step>(standalone ? 'intro' : 'closed');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const [gate, setGate] = useState<Gate>(null);

    // which maimai NET lookup is running, and since when, for the progress line
    const [waiting, setWaiting] = useState<{ kind: 'start' | 'verify'; since: number } | null>(null);
    const waited = useSecondsSince(waiting?.since ?? null);
    const progress = waiting ? PROGRESS[waiting.kind].find(([after]) => waited >= after)?.[1] : null;
    const progressLine = (kind: 'start' | 'verify') =>
        waiting?.kind === kind && progress ? <p className="cp-progress" role="status">{progress}</p> : null;

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
        setGate(data && !data.open
            ? { reason: data.reason, message: data.message ?? 'claims are paused right now. try again in a few minutes' }
            : null);
    };

    const open = () => { setError(null); setNote(null); setGate(null); setStep('intro'); void checkGate(); };

    // a standalone panel starts at the intro, so run the same check open() does
    useEffect(() => {
        if (standalone) void checkGate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // paused or busy: keep checking, so start comes back as soon as claims reopen
    useEffect(() => {
        if (!gate || step !== 'intro') return;
        const t = setInterval(() => void checkGate(), GATE_RECHECK_MS);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gate, step]);

    const close = () => {
        setError(null); setNote(null);
        if (standalone) router.push(standalone.closeHref);
        else setStep('closed');
    };

    // cancelling mid-claim gives the slot back so the next person doesn't wait on us
    const cancelClaim = () => { void post('/api/claim/cancel'); close(); };

    const start = async () => {
        setBusy(true); setError(null); setWaiting({ kind: 'start', since: Date.now() });
        const { ok, data } = await post('/api/claim/start', { webId, captchaToken });
        setBusy(false); setWaiting(null);
        if (!ok) {
            setCaptchaToken('');
            // the site updating, someone else claiming, or about to update: show it the
            // same way the pre-check does (busyUntil can be null: an update with no estimate)
            if ('busyUntil' in data) { setGate({ reason: 'busy', message: data.error }); setError(null); return; }
            if (data.closedUntil) { setGate({ reason: 'closed', message: data.error }); setError(null); return; }
            setError(data.error ?? 'something went wrong');
            return;
        }
        setStartTitle(data.currentTitle ?? null);
        setVerifyUntil(Date.parse(data.verifyUntil));
        setNow(Date.now());
        setStep('verify');
    };

    const verify = async () => {
        setBusy(true); setError(null); setNote(null); setWaiting({ kind: 'verify', since: Date.now() });
        const { ok, data } = await post('/api/claim/verify');
        setBusy(false); setWaiting(null);
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
        announceAuthChange();
        if (standalone) {
            // signed in now: off to their profile
            router.push(`/user/${data.webId ?? webId}`);
        } else {
            setStep('closed');
            router.refresh(); // re-render the profile as its owner
        }
    };

    // the element the flow renders into, found once the page is on screen
    const [flowSlot, setFlowSlot] = useState<HTMLElement | null>(null);
    useEffect(() => {
        if (flowSlotId) setFlowSlot(document.getElementById(flowSlotId));
    }, [flowSlotId]);

    // ----- the status line under the name -----
    // signed in on someone else's profile: they already have their one account,
    // so there's nothing to claim or sign in to here. the reset page has no status line
    const status = standalone || (signedInAs && !isOwner) ? null : (
        <p className="cp-status">
            {isOwner ? (
                <>
                    <span className="cp-pill">✓ this is you</span>
                    <span>signed in as <b>{signedInAs}</b></span>
                </>
            ) : claimed ? (
                <span className="cp-pill">✓ claimed profile</span>
            ) : (
                <>
                    <span className="cp-uc-pill">unclaimed profile</span>
                    {step === 'closed' && (
                        <span>is this you? <button type="button" className="cp-link" onClick={open}>claim this profile</button></span>
                    )}
                </>
            )}
        </p>
    );

    // ----- the flow -----
    const flow = step === 'closed' ? null : (
        <section className="cp-card" aria-live="polite">

            {step === 'intro' && (
                <>
                    <h2>{claimed ? 'reset access' : 'claim profile'}</h2>
                    {claimed ? (
                        <p>forgot your password? you can set a new one by proving this profile is yours again</p>
                    ) : (
                        <p>claiming your profile will let you create an account that you can sign in with. by creating an account, you'll be able to edit your profile's bio, pinned scores, favorite charts, and more!</p>
                    )}
                    <p>in order to {claimed ? 'reset your password' : 'claim your profile'}, we first need to prove that <b>{`${playerName}`}</b> is your maimai account. to do this, you'll need to temporarily change your <b>user title</b> on the maimai site, but don't change it just yet</p>
                    <p>first, press <b>start</b> below to begin</p>
                    {claimed && (
                        <p className="cp-muted">this replaces the current password and signs you out everywhere else</p>
                    )}
                    {gate && <p className="cp-error">{gate.message}</p>}
                    {captchaSiteKey && <div className="cp-captcha" ref={captchaBox} />}
                    {error && !gate && <p className="cp-error">{error}</p>}
                    <div className="cp-actions">
                        <button type="button" className="cp-btn cp-btn-quiet" onClick={close}>cancel</button>
                        {gate && (
                            <button type="button" className="cp-btn cp-btn-quiet" onClick={() => void checkGate()}>check again</button>
                        )}
                        <button type="button" className="cp-btn" onClick={start}
                            disabled={busy || Boolean(gate) || (Boolean(captchaSiteKey) && !captchaToken)}>
                            {busy ? <LoadingDots label="checking" /> : 'start'}
                        </button>
                    </div>
                    {progressLine('start')}
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
                            {busy ? <LoadingDots label="checking" /> : 'verify'}
                        </button>
                    </div>
                    {progressLine('verify')}
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
                            {busy ? <LoadingDots label="saving" /> : 'save and sign in'}
                        </button>
                    </div>
                </form>
            )}
        </section>
    );

    return (
        <>
            <style>{css}</style>
            {status}
            {flow && flowSlot ? createPortal(flow, flowSlot) : flow}
        </>
    );
}