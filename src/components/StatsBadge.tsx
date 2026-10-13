import type { Song } from '../lib/leaderboard';

// no 'use client' on purpose: this is plain markup, so it works in both server and client components

const css = `
  /* total / average badge. margin-left: auto pushes its right edge to the far side of a flex row */
  .bf-badge { display: inline-flex; align-items: center; justify-content: center; gap: 1rem; margin-left: auto;
    padding: 4px 16px; border-radius: 999px; background: rgba(127,127,127,0.12); }
  .bf-badge-stat { display: inline-flex; align-items: baseline; gap: 0.4rem; }
  .bf-badge-label { font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: lowercase; }
  .bf-badge-val { font-size: 1.05rem; font-weight: 800; font-variant-numeric: tabular-nums; }

/* the best 50 card's header, like the about me's: its small label on the left, the total /
     average and ceiling / floor pills on the right (under the label on phones) */
  .bf-b50 { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 1.25rem; }
  .bf-b50 h2 { margin: 0 auto 0 0; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.03em; color: var(--text-sub); }
  .bf-b50 .bf-badge { margin-left: 0; }
  .bf-b50-pills { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  @media (max-width: 600px) { .bf-b50-pills { align-items: flex-start; } }
  .bf-badge-lg { padding: 6px 20px; gap: 1.25rem; margin-bottom: 0.25rem; }
  .bf-badge-lg .bf-badge-label { font-size: 0.85rem; }
  .bf-badge-lg .bf-badge-val { font-size: 1.20rem; }
`;

// total of the ratings and the average per song
export function listStats(songs: Song[]) {
    const sum = songs.reduce((t, s) => t + Math.floor(s.rating), 0);
    const avg = songs.length ? sum / songs.length : 0;
    return { sum, avg };
}

function Stats({ songs, className = '' }: { songs: Song[]; className?: string }) {
    const { sum, avg } = listStats(songs);
    return (
        <div className={`bf-badge ${className}`}>
            <span className="bf-badge-stat">
                <span className="bf-badge-label">total</span>
                <span className="bf-badge-val">{sum}</span>
            </span>
            <span className="bf-badge-stat">
                <span className="bf-badge-label">avg</span>
                <span className="bf-badge-val">{avg.toFixed(2)}</span>
            </span>
        </div>
    );
}

function FloorCeiling({ songs }: { songs: Song[] }) {
    return (
        <div className="bf-badge">
                <span className="bf-badge-stat">
                    <span className="bf-badge-label">ceiling</span>
                    <span className="bf-badge-val">{Math.max(...songs.map(s => Math.floor(s.rating)))}</span>
                </span>
                <span className="bf-badge-stat">
                    <span className="bf-badge-label">floor</span>
                    <span className="bf-badge-val">{Math.min(...songs.map(s => Math.floor(s.rating)))}</span>
                </span>
            </div>
    )
}

// B15 / B35 version
export function StatsBadge({ songs }: { title?: string; songs: Song[] }) {
    return (
        <>
            <style>{css}</style>
            <Stats songs={songs} />
        </>
    );
}

// Best 50 header: centered title with the total / average badge underneath
export function Best50Stats({ b15, b35 }: { b15: Song[]; b35: Song[] }) {
    const all = [...b15, ...b35];
    if (all.length === 0) return null;
    return (
        <div className="bf-b50">
            <style>{css}</style>
            <h2>best 50 charts</h2>
            {/* total / average on top, ceiling / floor under it, on the right */}
            <div className="bf-b50-pills">
                <Stats songs={all} className="bf-badge-lg" />
                <FloorCeiling songs={all} />
            </div>
        </div>
    );
}