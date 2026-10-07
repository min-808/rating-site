'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * One admin action button: asks to confirm, calls /api/admin/action, then
 * re-renders the admin page with fresh data. The server checks admin rights
 * itself; this button is just the trigger.
 */
export default function AdminButton({ action, userId, claimId, label, confirmText, danger = false }: {
    action:
        | 'clear-bio' | 'unclaim' | 'sign-out'
        | 'hide-scores' | 'show-scores' | 'cancel-claim' | 'free-slot';
    userId?: string;
    claimId?: string;
    label: string;
    confirmText: string;
    danger?: boolean;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        if (!window.confirm(confirmText)) return;
        setBusy(true);
        setError(null);
        const res = await fetch('/api/admin/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, userId, claimId }),
        }).catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        setBusy(false);
        if (!res?.ok) { setError(data.error ?? 'something went wrong'); return; }
        router.refresh();
    };

    return (
        <span className="ad-btn-wrap">
            <button type="button" className={`ad-btn${danger ? ' ad-btn-danger' : ''}`} onClick={run} disabled={busy}>
                {busy ? '…' : label}
            </button>
            {error && <span className="ad-btn-error">{error}</span>}
        </span>
    );
}