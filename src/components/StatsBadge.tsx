import type { Song } from '../lib/leaderboard';

// no 'use client' on purpose: this is plain markup, so it works in both server and client components

const css = `
  /* total / average badge. margin-left: auto pushes its right edge to the far side of a flex row */
  .bf-badge { display: inline-flex; align-items: center; justify-content: center; gap: 1rem; margin-left: auto;
    padding: 4px 16px; border-radius: 999px; background: rgba(127,127,127,0.12); }
  .bf-badge-stat { display: inline-flex; align-items: baseline; gap: 0.4rem; }
  .bf-badge-label { font-size: 0.75rem; font-weight: 700; color: #b96de4; text-transform: lowercase; }
  .bf-badge-val { font-size: 1.05rem; font-weight: 800; font-variant-numeric: tabular-nums; }

/* the Best 50 block: heading on top, total / average badge underneath, centered */
  .bf-b50 { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin: 0 0 1.5rem;
    text-align: center; }
  .bf-b50 h2 { margin: 0.5rem; font-size: 2rem; }
  .bf-b50 .bf-badge { margin-left: 0; }
`;

// total of the ratings and the average per song
export function listStats(songs: Song[]) {
    const sum = songs.reduce((t, s) => t + Math.floor(s.rating), 0);
    const avg = songs.length ? sum / songs.length : 0;
    return { sum, avg };
}

function Stats({ songs }: { songs: Song[] }) {
    const { sum, avg } = listStats(songs);
    return (
        <div className="bf-badge">
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
            <h2>Best 50 Charts</h2>
            <Stats songs={all} />
        </div>
    );
}