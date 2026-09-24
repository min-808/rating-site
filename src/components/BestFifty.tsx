'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Song } from '../lib/leaderboard';
import { new15, old35, rankFor, rateSong, RANK_CUTOFFS, RATING_CAP } from '../lib/song-calc';
import FallbackImage from './FallbackImage';

const css = `
  /* page, header, sections, grid */
  .bf-wrap { padding: 0 2rem 2rem 2rem; max-width: 1000px; margin: 0 auto; font-family: sans-serif; }
  .bf-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.25rem 1rem; }
  .bf-head h1 { margin: 0.5rem 0; }
  .bf-sub-total { color: var(--text-sub); font-size: 0.85rem; }
  .bf-section { display: flex; align-items: baseline; gap: 0.75rem; margin: 1.5rem 0 0.75rem; }
  .bf-section h2 { margin: 0; }
  .bf-section > span { font-size: 0.8rem; color: var(--text-sub); }
  .bf-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
  .bf-empty { color: var(--text-muted); font-size: 0.85rem; }

  /* the card is now a <button> so it is clickable and keyboard-friendly.
     Inner pieces are <span>s (a div inside a button is invalid HTML) */
  .bf-card { position: relative; isolation: isolate; display: flex; flex-direction: column; width: 100%;
    min-width: 0; padding: 0; overflow: hidden; text-align: left; font: inherit; color: inherit;
    background: none; border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; }
  .bf-card:hover { border-color: var(--text-sub); }
  .bf-card:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .bf-band { display: flex; justify-content: space-between; background: var(--diff); color: #fff;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.6); font-size: 0.75rem; font-weight: bold; padding: 3px 8px; }
  .bf-body { display: flex; flex-direction: column; gap: 4px; padding: 8px; min-width: 0; }
  .bf-title { display: block; font-size: 0.85rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bf-ach { display: block; font-size: 1.15rem; font-weight: bold; font-variant-numeric: tabular-nums; }
  .bf-row { display: flex; align-items: center; gap: 6px; }
  .bf-rating { margin-left: auto; font-size: 1.05rem; font-weight: bold; font-variant-numeric: tabular-nums; }
  .bf-tag { font-size: 0.7rem; font-weight: bold; padding: 1px 6px; border-radius: 4px; }
  .bf-gold { background: #f2b52c; color: #3b2a00; }
  .bf-silver { background: #c4c9d1; color: #22262b; }
  .bf-plain, .bf-none { background: var(--border-light); color: var(--text-sub); }
  .bf-ap { background: #ff8a3d; color: #2b1200; }
  .bf-meta { display: block; font-size: 0.7rem; color: var(--text-sub); font-variant-numeric: tabular-nums; }

  /* cover art fills the card behind a dark layer. Change --bf-dim to make the art brighter or darker */
  .bf-card { --bf-dim: 0.62; }
  .bf-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2; }
  .bf-dim { position: absolute; inset: 0; z-index: -1; background: rgba(0,0,0,var(--bf-dim)); }
  .bf-has-art .bf-body { color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.85); }
  .bf-has-art .bf-meta { color: #e6e6e6; }
  .bf-has-art .bf-plain, .bf-has-art .bf-none { background: rgba(255,255,255,0.22); color: #fff; text-shadow: none; }

  /* detail popup */
  .bf-dialog { width: min(440px, calc(100vw - 2rem)); padding: 0; border: 1px solid var(--border-light);
    border-radius: 10px; background: var(--bg-color); color: var(--text-main); font-family: sans-serif; }
  .bf-dialog::backdrop { background: rgba(0,0,0,0.55); }
  .bf-dlg { padding: 1rem; }
  .bf-dlg-head { display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 1rem; }
  .bf-dlg-art { width: 96px; height: 96px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
  .bf-dlg-title { margin: 0 0 0.35rem; font-size: 1.05rem; overflow-wrap: anywhere; }
  .bf-dlg-chip { display: inline-block; background: var(--diff); color: #fff; font-size: 0.75rem; font-weight: bold;
    padding: 2px 8px; border-radius: 4px; text-shadow: 1px 1px 2px rgba(0,0,0,0.6); }
  .bf-dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.4rem 1rem; margin: 0 0 1rem; font-size: 0.85rem; }
  .bf-dl dt { color: var(--text-sub); }
  .bf-dl dd { margin: 0; font-variant-numeric: tabular-nums; }
  .bf-dlg-close { font: inherit; font-size: 0.85rem; padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer;
    background: var(--border-light); color: var(--text-main); border: 1px solid var(--border-light); }

  @media (max-width: 600px) {
    .bf-wrap { padding: 0 0.5rem 1rem 0.5rem; }
    .bf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.4rem; }
  }
`;

const DIFFS: Record<string, { label: string; color: string }> = {
    basic: { label: 'Basic', color: '#22a352' },
    advanced: { label: 'Advanced', color: '#d99000' },
    expert: { label: 'Expert', color: '#e0403a' },
    master: { label: 'Master', color: '#9b4fd1' },
    remaster: { label: 'Re:Master', color: '#b48be0' },
};
function diffOf(raw: string) {
    const key = (raw ?? '').toLowerCase().replace(/[^a-z]/g, '');
    return DIFFS[key] ?? { label: raw || 'Unknown', color: '#888888' };
}
function rankTone(rank: string | undefined) {
    if (!rank) return 'none';
    if (rank.startsWith('SS')) return 'gold';
    if (rank.startsWith('S')) return 'silver';
    return 'plain';
}

// what the popup needs to know about the clicked card
type Selected = { song: Song; position: number; list: string; size: number };

// next rank up, and what the song would rate at exactly that achievement
function nextRankInfo(song: Song) {
    const i = RANK_CUTOFFS.findIndex((c) => song.achievement >= c.min);
    if (i <= 0) return null; // no rank yet, or already at the top rank
    const next = RANK_CUTOFFS[i - 1];
    const rating = rateSong({ ...song, achievement: next.min });
    return { rank: next.rank, at: next.min, rating, gain: rating - song.rating };
}

function SongCard({ song, position, onOpen }: { song: Song; position: number; onOpen: () => void }) {
    const diff = diffOf(song.difficulty);
    const rank = rankFor(song.achievement)?.rank;
    const isDx = /dx/i.test(song.kind ?? '');
    const hasArt = Boolean(song.jacket_blob || song.jacket); // NEW

    return (
        <li>
            <button
                type="button"
                className={`bf-card${hasArt ? ' bf-has-art' : ''}`}
                style={{ '--diff': diff.color } as CSSProperties}
                onClick={onOpen}
            >
                {hasArt && <FallbackImage src={song.jacket_blob} fallbackSrc={song.jacket} alt="" className="bf-art" />}
                {hasArt && <span className="bf-dim" aria-hidden="true" />}
                <span className="bf-band">
          <span>{diff.label} {song.level}</span>
          <span>{isDx ? 'DX' : 'STD'}</span>
        </span>
                <span className="bf-body">
          <span className="bf-title" title={song.title}>{song.title}</span>
          <span className="bf-ach">{song.achievement == null ? '-' : `${song.achievement.toFixed(4)}%`}</span>
          <span className="bf-row">
            <span className={`bf-tag bf-${rankTone(rank)}`}>{rank ?? '-'}</span>
              {song.ap && <span className="bf-tag bf-ap">AP</span>}
              <span className="bf-rating">{song.rating}</span>
          </span>
          <span className="bf-meta">{song.internal_difficulty?.toFixed(1)} internal, #{position}</span>
        </span>
            </button>
        </li>
    );
}

// passes a click handler down, and reports which card was opened
function Section({ title, note, songs, onOpen }: { title: string; note: string; songs: Song[]; onOpen: (s: Selected) => void }) {
    const total = songs.reduce((sum, s) => sum + Math.floor(s.rating), 0);

    return (
        <section>
            <div className="bf-section">
                <h2>{title}</h2>
                <span>{note}, {total} rating</span>
            </div>
            {songs.length === 0 ? (
                <p className="bf-empty">no rated songs here yet</p>
            ) : (
                <ul className="bf-grid">
                    {songs.map((song, i) => (
                        <SongCard
                            key={`${song.difficulty}-${song.kind}-${song.title}`}
                            song={song}
                            position={i + 1}
                            onOpen={() => onOpen({ song, position: i + 1, list: title, size: songs.length })}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

// The popup, using the browser's built-in <dialog> (Esc closes it, focus is handled for you)
function SongDetail({ entry, onClose }: { entry: Selected | null; onClose: () => void }) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (entry && !d.open) d.showModal();
        if (!entry && d.open) d.close();
    }, [entry]);

    const song = entry?.song;
    const diff = song ? diffOf(song.difficulty) : null;
    const cutoff = song ? rankFor(song.achievement) : null;
    const next = song ? nextRankInfo(song) : null;
    const raw = song && cutoff
        ? song.internal_difficulty * cutoff.factor * Math.min(song.achievement, RATING_CAP)
        : 0;

    return (
        <dialog
            ref={ref}
            className="bf-dialog"
            aria-label="Song details"
            onClose={onClose}
            onClick={(e) => { if (e.target === ref.current) onClose(); }} // click on the dark backdrop closes it
        >
            {entry && song && diff && (
                <div className="bf-dlg" key={`${song.difficulty}-${song.kind}-${song.title}`} style={{ '--diff': diff.color } as CSSProperties}>
                    <div className="bf-dlg-head">
                        {(song.jacket_blob || song.jacket) && (
                            <FallbackImage src={song.jacket_blob} fallbackSrc={song.jacket} alt="" className="bf-dlg-art" width={96} height={96} />
                        )}
                        <div>
                            <h3 className="bf-dlg-title">{song.title}</h3>
                            <span className="bf-dlg-chip">{diff.label} {song.level} {/dx/i.test(song.kind ?? '') ? 'DX' : 'STD'}</span>
                        </div>
                    </div>

                    <dl className="bf-dl">
                        <dt>Achievement</dt><dd>{song.achievement.toFixed(4)}% ({cutoff?.rank ?? 'no rank'}{song.ap ? ', AP' : ''})</dd>
                        <dt>Rating</dt><dd>{song.rating}</dd>
                        <dt>How it's worked out</dt>
                        <dd>
                            {song.internal_difficulty.toFixed(1)} × {cutoff?.factor ?? 0} × {Math.min(song.achievement, RATING_CAP)} = {raw.toFixed(2)},
                            rounded down to {Math.floor(raw)}{song.ap ? ', plus 1 for AP' : ''}
                        </dd>
                        <dt>Position</dt><dd>#{entry.position} of {entry.size} in {entry.list}</dd>
                        <dt>Next rank</dt>
                        <dd>
                            {next
                                ? `${next.rank} at ${next.at.toFixed(4)}% would rate ${next.rating} (${next.gain >= 0 ? '+' : ''}${next.gain})`
                                : 'Already at the highest rank'}
                        </dd>
                    </dl>

                    <button type="button" className="bf-dlg-close" onClick={onClose}>Close</button>
                </div>
            )}
        </dialog>
    );
}

export default function BestFifty({ data }: { data?: Song[] | null }) {
    const [selected, setSelected] = useState<Selected | null>(null);
    const songs = data ?? [];
    const b15 = new15(songs);
    const b35 = old35(songs);
    const sum = (list: Song[]) => list.reduce((t, s) => t + Math.floor(s.rating), 0);
    const total = sum(b15) + sum(b35);

    return (
        <div className="bf-wrap">
            <style>{css}</style>

            <div className="bf-head">
                <h1>Rating: {total}</h1>
                <span className="bf-sub-total">{sum(b15)} from B15 and {sum(b35)} from B35</span>
            </div>

            <Section title="B15" note="newest songs" songs={b15} onOpen={setSelected} />
            <Section title="B35" note="older songs" songs={b35} onOpen={setSelected} />

            <SongDetail entry={selected} onClose={() => setSelected(null)} />
        </div>
    );
}