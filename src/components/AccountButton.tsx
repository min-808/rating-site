'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import FallbackImage from './FallbackImage';

/**
 * Top-right account button: "sign in" when signed out. Signed in, it's their
 * in-game icon and username, and opens a small menu: your profile, admin (admins
 * only), sign out.
 *
 * It asks /api/auth/me in the browser instead of the layout reading cookies, so
 * pages stay cacheable. It re-checks on navigation, and whenever another part of
 * the site signs in or out (they fire AUTH_EVENT).
 */

export const AUTH_EVENT = 'hm-auth-changed';

// call after signing in or out, so the header updates without a reload
export function announceAuthChange() {
    window.dispatchEvent(new Event(AUTH_EVENT));
}

type Me =
    | { signedIn: false }
    | {
        signedIn: true;
        username: string;
        webId: number | null;
        icon?: string | null;
        iconFallback?: string | null;
        scoresHidden?: boolean;
        isAdmin?: boolean;
    };

const css = `
  /* same look as the leaderboard / faq buttons in the header */
  .acct-btn { display: inline-flex; align-items: center; gap: 6px; max-width: 10rem; box-sizing: border-box;
    padding: 0.4rem 1rem; background-color: var(--btn-bg); border: 1px solid var(--btn-border);
    border-radius: 6px; text-decoration: none; color: var(--btn-text); font: inherit; font-weight: bold;
    cursor: pointer; }
  .acct-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .acct-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* reserve the space while loading, so nothing jumps */
  .acct-placeholder { visibility: hidden; }

  /* signed in: icon + name. a little less padding on the left, so the round icon sits snug */
  .acct-wrap { position: relative; }
  .acct-trigger { padding-left: 0.4rem; padding-right: 0.6rem; }
  .acct-icon { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
    background: rgba(127,127,127,0.2); }
  .acct-chev { flex-shrink: 0; opacity: 0.6; transition: transform 0.15s ease; }
  .acct-trigger[aria-expanded="true"] .acct-chev { transform: rotate(180deg); }

  .acct-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 50; min-width: 14rem;
    padding: 4px; margin: 0; list-style: none; box-sizing: border-box;
    background: var(--btn-bg); border: 1px solid var(--btn-border); border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
  .acct-menu-head { padding: 6px 10px 8px; font-size: 0.75rem; color: var(--text-sub);
    border-bottom: 1px solid var(--btn-border); margin-bottom: 4px; overflow-wrap: anywhere; }
  .acct-menu-head b { color: var(--btn-text); }
  .acct-item { display: block; width: 100%; box-sizing: border-box; padding: 7px 10px; border: 0; border-radius: 5px;
    background: transparent; color: var(--btn-text); font: inherit; font-size: 0.9rem; text-align: left;
    text-decoration: none; cursor: pointer; }
  .acct-item:hover, .acct-item:focus-visible { background: rgba(127,127,127,0.15); outline: none; }
  .acct-item:disabled { opacity: 0.55; cursor: default; }
  .acct-sep { height: 1px; margin: 4px 0; background: var(--btn-border); }
  /* "show my scores": a menu item with an on / off switch on the right, blue when on */
  .acct-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; white-space: nowrap; }
  .acct-switch { position: relative; flex-shrink: 0; width: 32px; height: 18px; border-radius: 999px;
    background: rgba(127,127,127,0.4); transition: background-color 0.2s ease; }
  .acct-toggle[aria-checked="true"] .acct-switch { background: #2563eb; }
  .acct-knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff;
    box-shadow: 0 1px 2px rgba(0,0,0,0.3); transition: transform 0.2s ease; }
  .acct-toggle[aria-checked="true"] .acct-knob { transform: translateX(14px); }
  .acct-note { padding: 0 10px 6px; font-size: 0.72rem; line-height: 1.35; color: var(--text-sub); }
  .acct-note-error { color: #e11d48; }
  @media (prefers-reduced-motion: reduce) {
    .acct-switch, .acct-knob { transition: none; }
  }

  @media (max-width: 600px) {
    /* phones: same style, just capped so a long username can't crowd the header */
    .acct-btn { max-width: 7rem; }
    /* signed in: just the icon, so it can't run into the leaderboard / faq buttons.
       the menu's "signed in as" line still shows the name. (no icon: keep the name) */
    .acct-trigger:has(.acct-icon) .acct-name { display: none; }
    .acct-trigger { padding-right: 0.5rem; }
  }
`;

const Chevron = () => (
    <svg className="acct-chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function AccountButton() {
    const pathname = usePathname();
    const [me, setMe] = useState<Me | null>(null);

    useEffect(() => {
        let cancelled = false;
        const check = () =>
            fetch('/api/auth/me', { cache: 'no-store' })
                .then((r) => r.json())
                .then((data: Me) => { if (!cancelled) setMe(data); })
                .catch(() => { if (!cancelled) setMe({ signedIn: false }); });

        check();
        window.addEventListener(AUTH_EVENT, check);
        return () => {
            cancelled = true;
            window.removeEventListener(AUTH_EVENT, check);
        };
    }, [pathname]);

    if (!me) {
        return (
            <>
                <style>{css}</style>
                <span className="acct-btn acct-placeholder" aria-hidden="true">sign in</span>
            </>
        );
    }

    if (!me.signedIn) {
        return (
            <>
                <style>{css}</style>
                <Link href="/login" className="acct-btn">sign in</Link>
            </>
        );
    }

    return <AccountMenu me={me} />;
}

function AccountMenu({ me }: { me: Extract<Me, { signedIn: true }> }) {
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    // "show my scores": whether their scores are hidden from their profile (scores_opt_out)
    const [scoresHidden, setScoresHidden] = useState(Boolean(me.scoresHidden));
    const [savingScores, setSavingScores] = useState(false);
    const [scoresError, setScoresError] = useState<string | null>(null);
    useEffect(() => { setScoresHidden(Boolean(me.scoresHidden)); }, [me.scoresHidden]);
    const wrapRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    // opened from the keyboard: put focus on the first item, like a native menu
    const focusFirst = useRef(false);

    const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('.acct-item') ?? [])];

    // close on navigation (e.g. after picking "your profile")
    useEffect(() => { setOpen(false); }, [pathname]);

    useEffect(() => {
        if (!open) return;
        if (focusFirst.current) { items()[0]?.focus(); focusFirst.current = false; }

        // a click or tap anywhere outside closes it
        const onPointer = (e: PointerEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        // escape closes it wherever focus is (after a mouse click it's still on the button)
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const onTriggerKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            focusFirst.current = true;
            if (open) items()[0]?.focus();
            else setOpen(true);
        }
    };

    // up / down move between items, tab leaves (escape is handled above)
    const onMenuKey = (e: React.KeyboardEvent) => {
        const list = items();
        const i = list.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
        else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
        else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
        else if (e.key === 'Tab') setOpen(false);
    };

    // flips "show my scores". the menu stays open so they can see it change
    const toggleScores = async () => {
        const next = !scoresHidden;
        setSavingScores(true); setScoresError(null);
        const res = await fetch('/api/profile/scores-visibility', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hidden: next }),
        }).catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        setSavingScores(false);
        if (!res?.ok) { setScoresError(data.error ?? 'something went wrong'); return; }
        setScoresHidden(Boolean(data.hidden));
        router.refresh(); // their profile, if it's open, shows or hides the scores right away
    };

    const signOut = async () => {
        setSigningOut(true);
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
        setSigningOut(false);
        setOpen(false);
        announceAuthChange();
        router.refresh(); // a profile they own goes back to its public view
    };

    return (
        <div className="acct-wrap" ref={wrapRef}>
            <style>{css}</style>
            <button
                ref={triggerRef}
                type="button"
                className="acct-btn acct-trigger"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls="acct-menu"
                title={`signed in as ${me.username}`}
                onClick={() => setOpen((o) => !o)}
                onKeyDown={onTriggerKey}
            >
                <FallbackImage src={me.icon ?? undefined} fallbackSrc={me.iconFallback ?? undefined} alt="" className="acct-icon" width={22} height={22} />
                <span className="acct-name">{me.username}</span>
                <Chevron />
            </button>

            {open && (
                <div id="acct-menu" className="acct-menu" role="menu" aria-label="account" ref={menuRef} onKeyDown={onMenuKey}>
                    <div className="acct-menu-head" role="presentation">signed in as <b>{me.username}</b></div>
                    {me.webId != null && (
                        <Link href={`/user/${me.webId}`} className="acct-item" role="menuitem" onClick={() => setOpen(false)}>
                            your profile
                        </Link>
                    )}
                    {me.isAdmin && (
                        <Link href="/admin" className="acct-item" role="menuitem" onClick={() => setOpen(false)}>
                            admin
                        </Link>
                    )}
                    {me.webId != null && (
                        <>
                            <div className="acct-sep" role="separator" />
                            <button type="button" className="acct-item acct-toggle" role="menuitemcheckbox"
                                aria-checked={!scoresHidden} onClick={toggleScores} disabled={savingScores}>
                                show my scores
                                <span className="acct-switch" aria-hidden="true"><span className="acct-knob" /></span>
                            </button>
                            <div className={`acct-note${scoresError ? ' acct-note-error' : ''}`} role="presentation">
                                {scoresError ?? (scoresHidden
                                    ? 'your best 50, play stats and favorites are hidden'
                                    : 'turn off to hide your best 50, play stats and favorites')}
                            </div>
                        </>
                    )}
                    <div className="acct-sep" role="separator" />
                    <button type="button" className="acct-item" role="menuitem" onClick={signOut} disabled={signingOut}>
                        {signingOut ? 'signing out…' : 'sign out'}
                    </button>
                </div>
            )}
        </div>
    );
}
