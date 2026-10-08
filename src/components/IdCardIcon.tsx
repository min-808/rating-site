// the "past names" icon, an id card: a person on the left, two lines of text on
// the right. used next to names on profiles and on the leaderboard.
// plain markup, no 'use client', so server and client components can both use it
export default function IdCardIcon({ width = 22, className }: { width?: number; className?: string }) {
    return (
        <svg className={className} width={width} height={(width * 16) / 22} viewBox="0 0 22 16" aria-hidden="true">
            <rect x="0.75" y="0.75" width="20.5" height="14.5" rx="2.5" fill="currentColor" />
            <circle cx="7" cy="6" r="2.4" fill="var(--bg-color)" />
            <path d="M3.2 12.6c0-2.2 1.7-3.6 3.8-3.6s3.8 1.4 3.8 3.6z" fill="var(--bg-color)" />
            <rect x="12.5" y="5" width="6" height="1.6" rx="0.8" fill="var(--bg-color)" />
            <rect x="12.5" y="8.6" width="6" height="1.6" rx="0.8" fill="var(--bg-color)" />
        </svg>
    );
}
