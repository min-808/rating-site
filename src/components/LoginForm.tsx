'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { announceAuthChange } from './AccountButton';

// resetHref: where "forgot your password?" leads, when the visitor came from a claimed
// profile's "sign in" link. without it, they're told how to get there instead
export default function LoginForm({ resetHref = null }: { resetHref?: string | null }) {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) {
            setError(data.error ?? 'Something went wrong.');
            return;
        }
        announceAuthChange();
        // straight to their own profile
        router.push(data.webId ? `/user/${data.webId}` : '/');
        router.refresh();
    };

    return (
        <form className="lg-card" onSubmit={submit}>
            <h1>Sign in</h1>

            <div className="lg-field">
                <label htmlFor="lg-username">Username</label>
                <input id="lg-username" value={username} onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username" autoFocus required />
            </div>
            <div className="lg-field">
                <label htmlFor="lg-password">Password</label>
                <input id="lg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password" required />
            </div>

            {error && <p className="lg-error">{error}</p>}

            <button type="submit" className="lg-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>

            <p className="lg-help">
                <Link href="/loginhelp">Don&apos;t have an account?</Link>
            </p>
            {resetHref ? (
                <p className="lg-help">
                    Forgot your password? <Link href={resetHref}>Reset access</Link> by verifying your profile again.
                </p>
            ) : (
                <p className="lg-help">
                    Forgot your password? Open your profile from the leaderboard and press <b>sign in</b>. The
                    sign-in page you land on has a link to reset access.
                </p>
            )}
        </form>
    );
}