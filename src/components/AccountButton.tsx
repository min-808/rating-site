'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Top-right account button: "sign in" when signed out, the username (linking to
 * their profile) when signed in.
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

type Me = { signedIn: false } | { signedIn: true; username: string; webId: number | null };

const css = `
  /* same look as the leaderboard / faq buttons in the header */
  .acct-btn { display: inline-flex; align-items: center; gap: 6px; max-width: 10rem; box-sizing: border-box;
    padding: 0.4rem 1rem; background-color: var(--btn-bg); border: 1px solid var(--btn-border);
    border-radius: 6px; text-decoration: none; color: var(--btn-text); font-weight: bold; }
  .acct-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .acct-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .acct-dot { width: 7px; height: 7px; border-radius: 50%; background: #22a35a; flex-shrink: 0; }
  /* reserve the space while loading, so nothing jumps */
  .acct-placeholder { visibility: hidden; }
  @media (max-width: 600px) {
    /* phones: same style, just capped so a long username can't crowd the header */
    .acct-btn { max-width: 7rem; }
  }
`;

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

    return (
        <>
            <style>{css}</style>
            <Link
                href={me.webId ? `/user/${me.webId}` : '/login'}
                className="acct-btn"
                title={`Signed in as ${me.username}`}
            >
                <span className="acct-dot" aria-hidden="true" />
                <span className="acct-name">{me.username}</span>
            </Link>
        </>
    );
}