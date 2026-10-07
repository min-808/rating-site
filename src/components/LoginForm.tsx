'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { announceAuthChange } from './AccountButton';

export default function LoginForm() {
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
            setError(data.error ?? 'something went wrong');
            return;
        }
        announceAuthChange();
        // straight to their own profile
        router.push(data.webId ? `/user/${data.webId}` : '/');
        router.refresh();
    };

    return (
        <form className="lg-card" onSubmit={submit}>
            <h1>sign in</h1>

            <div className="lg-field">
                <label htmlFor="lg-username">username</label>
                <input id="lg-username" value={username} onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username" autoFocus required />
            </div>
            <div className="lg-field">
                <label htmlFor="lg-password">password</label>
                <input id="lg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password" required />
            </div>

            {error && <p className="lg-error">{error}</p>}

            <button type="submit" className="lg-btn" disabled={busy}>{busy ? 'signing in…' : 'sign in'}</button>

            <p className="lg-help">
                <Link href="/loginhelp">don&apos;t have an account?</Link>
            </p>
            <p className="lg-help">
                <Link href="/login/reset">forgot your password?</Link>
            </p>
        </form>
    );
}