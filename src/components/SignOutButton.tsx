'use client';

import { useRouter } from 'next/navigation';
import { announceAuthChange } from './AccountButton';

export default function SignOutButton({ className }: { className?: string }) {
    const router = useRouter();
    return (
        <button
            type="button"
            className={className}
            onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                announceAuthChange();
                router.refresh();
            }}
        >
            sign out
        </button>
    );
}