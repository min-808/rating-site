import type { Song } from '../lib/leaderboard';

// no 'use client' on purpose: this is plain markup, so it works in both server and client components

const css = `
  /* sum / average / projected badge. margin-left: auto pushes its right edge to the far side of a flex row */
  .bf-badge { display: inline-flex; align-items: center; justify-content: center; gap: 1rem; margin-left: auto;
    padding: 4px 16px; border-radius: 999px; background: rgba(127,127,127,0.12); }
  .bf-badge-stat { display: inline-flex; align-items: baseline; gap: 0.4rem; cursor: help; }
  .bf-badge-sym { font-size: 0.95rem; font-weight: 800; color: #b96de4; }
  .bf-badge-val { font-size: 1.05rem; font-weight: 800; font-variant-numeric: tabular-nums; }

  /* the B50 row under the history chart: "B50" label + badge, centered */
  .bf-b50-row { display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin: 0 0 1rem; }
  .bf-b50-row h2 { margin: 0; font-size: 1.2rem; }
  .bf-b50-row .bf-badge { margin-left: 0; }
`;

// symbols for the summary; swap any to try another (e.g. 'ρ', 'Ω', 'Ψ')
export const SYMBOLS = { sum: 'Σ', avg: 'μ', projected: 'φ' };

// sum of ratings, average per song, and the total you'd have if all 50 slots averaged that much
export function listStats(songs: Song[]) {
    const sum = songs.reduce((t, s) => t + Math.floor(s.rating), 0);
    const avg = songs.length ? sum / songs.length : 0;
    return { sum, avg, projected: Math.round(avg * 50) };
}

// B15 / B35 version: sum, average, and projected 50-slot total
export function StatsBadge({ title, songs }: { title: string; songs: Song[] }) {
    const { sum, avg, projected } = listStats(songs);
    return (
        <div className="bf-badge">
            <style>{css}</style>
            <span className="bf-badge-stat" title={`Sum of the ${title} ratings`}>
                <span className="bf-badge-sym">{SYMBOLS.sum}</span>
                <span className="bf-badge-val">{sum}</span>
            </span>
            <span className="bf-badge-stat" title={`Average rating per song in ${title}`}>
                <span className="bf-badge-sym">{SYMBOLS.avg}</span>
                <span className="bf-badge-val">{avg.toFixed(2)}</span>
            </span>
            <span className="bf-badge-stat" title={`Your total rating if all 50 songs averaged ${avg.toFixed(2)} (average × 50)`}>
                <span className="bf-badge-sym">{SYMBOLS.projected}</span>
                <span className="bf-badge-val">~{projected}</span>
            </span>
        </div>
    );
}

// B50 version: only sum + average (a projected total would just repeat the sum)
export function Best50Stats({ b15, b35 }: { b15: Song[]; b35: Song[] }) {
    const all = [...b15, ...b35];
    if (all.length === 0) return null;
    const { sum, avg } = listStats(all);
    return (
        <div className="bf-b50-row">
            <style>{css}</style>
            <h2>B50</h2>
            <div className="bf-badge">
                <span className="bf-badge-stat" title="Sum of the B50 ratings (B15 + B35)">
                    <span className="bf-badge-sym">{SYMBOLS.sum}</span>
                    <span className="bf-badge-val">{sum}</span>
                </span>
                <span className="bf-badge-stat" title={`Average rating per song across the ${all.length} songs in B50`}>
                    <span className="bf-badge-sym">{SYMBOLS.avg}</span>
                    <span className="bf-badge-val">{avg.toFixed(2)}</span>
                </span>
            </div>
        </div>
    );
}