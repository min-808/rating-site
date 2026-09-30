'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Song } from '../lib/leaderboard';
import { new15, old35, rankFor, rateSong, RANK_CUTOFFS } from '../lib/song-calc';
import FallbackImage from './FallbackImage';
import { StatsBadge } from './StatsBadge';

const BADGE_BASE = 'https://img.himaimai.net/badge';

type ComboTier = 'fc' | 'fcplus' | 'ap' | 'applus';
type SyncTier = 'sync' | 'fs' | 'fsplus' | 'fdx' | 'fdxplus';

const COMBO_BADGES: Record<ComboTier, string> = {
    fc: `${BADGE_BASE}/fc.png`,
    fcplus: `${BADGE_BASE}/fcp.png`,
    ap: `${BADGE_BASE}/ap.png`,
    applus: `${BADGE_BASE}/app.png`,
};

const SYNC_BADGES: Partial<Record<SyncTier, string>> = {
    fs: `${BADGE_BASE}/fs.png`,
    fsplus: `${BADGE_BASE}/fsp.png`,
    fdx: `${BADGE_BASE}/fdx.png`,
    fdxplus: `${BADGE_BASE}/fdxp.png`,
};

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
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .bf-empty { color: var(--text-muted); font-size: 0.85rem; }

    /* ============ CARD ============ */
  .bf-card { position: relative; isolation: isolate; display: flex; flex-direction: column; width: 100%;
    min-width: 0; padding: 0; overflow: hidden; text-align: left; font: inherit; color: #fff;
    background: #141416; border: none; border-radius: 12px; cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
  .bf-card:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.45); }
  .bf-card:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

  .bf-art-wrap { position: relative; aspect-ratio: 1 / 1.02; width: 100%; overflow: hidden; }
  .bf-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .bf-dim { position: absolute; inset: 0; background: rgba(0,0,0,0.45); }

  .bf-rating-badge { position: absolute; top: 0; right: 0; padding: 5px 10px 5px 12px;
    background: linear-gradient(135deg, #b768d6, #de7cce); color: #fff; font-weight: 800;
    font-size: 1.15rem; line-height: 1; border-radius: 0 12px 0 12px; text-shadow: 0 1px 2px rgba(0,0,0,0.35);
    font-variant-numeric: tabular-nums; }

  /* top-right badge: the chart's difficulty value, in the difficulty color */
  .bf-level-badge { position: absolute; top: 0; right: 0; padding: 5px 10px 5px 12px;
    background: var(--diff); color: #fff; font-weight: 800; font-size: 1.1rem; line-height: 1;
    border-radius: 0 12px 0 12px; text-shadow: 0 1px 2px rgba(0,0,0,0.65);
    box-shadow: 0 1px 4px rgba(0,0,0,0.35); font-variant-numeric: tabular-nums; }

  /* Re:MASTER only: lavender-to-pink from the in-game result header, pale edge, navy text outline */
  .bf-level-remaster { background: linear-gradient(135deg, #c592e0 0%, #b96de4 45%, #ff50b9 100%);
    text-shadow: 0 0 3px #2a3679, 0 1px 2px #2a3679;
    box-shadow: 0 1px 4px rgba(0,0,0,0.35), inset 0 0 0 1px #ffebff; }
    
  /* text block over the bottom of the art: 3 rows.
   padding-top sets how tall the fade zone is; the stops set how fast it goes dark. */
  .bf-overlay { position: absolute; left: 0; right: 0; bottom: 0; padding: 10px 6px 4px;
    display: flex; flex-direction: column; gap: 1px;
    background: linear-gradient(to top,
      rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 15%, rgba(0,0,0,0.70) 30%,
      rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.2) 95%, rgba(0,0,0,0) 100%); }
  .bf-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; }
  .bf-rating { font-size: 1.3rem; font-weight: 800; color: #fff; line-height: 1.1;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8); font-variant-numeric: tabular-nums; }
  .bf-ach { font-size: 0.85rem; font-weight: 700; color: #e9e9e9; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bf-title { flex: 1; min-width: 0; font-size: 0.78rem; font-weight: 700;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
  .bf-kind-row { display: flex; justify-content: flex-end; margin-top: 2px; }

  .bf-tag { font-size: 0.68rem; font-weight: 800; padding: 1px 6px; border-radius: 4px; flex-shrink: 0; }

  /* rank colors build up: red/pink (A to AAA), gold (S to SS+), rainbow (SSS, SSS+) */
  .bf-none { background: rgba(255,255,255,0.18); color: #fff; }
  .bf-r-a    { background: #f4a7bd; color: #4a0f22; }
  .bf-r-aa   { background: #e0527f; color: #fff; }
  .bf-r-aaa  { background: linear-gradient(135deg, #d92d4a, #e8407a); color: #fff;
               box-shadow: 0 0 6px rgba(232,64,122,0.55); }
  .bf-r-s    { background: #d9b45a; color: #3b2a00; }
  .bf-r-sp   { background: #e6c04a; color: #3b2a00; }
  .bf-r-ss   { background: linear-gradient(135deg, #f5d04a, #e0a51f); color: #3b2500;
               box-shadow: 0 0 6px rgba(245,208,74,0.5); }
  .bf-r-ssp  { background: linear-gradient(135deg, #fff0a0, #f5c531 45%, #e09a12); color: #3b2500;
               box-shadow: 0 0 0 1px rgba(255,243,176,0.8), 0 0 9px rgba(255,214,80,0.75); }
  .bf-r-sss  { background: linear-gradient(135deg, #fffdf2, #ffeeb0 45%, #f5d56e); color: #4a3200;
             box-shadow: 0 0 0 1px rgba(255,252,230,0.95), 0 0 10px rgba(255,236,160,0.85); }
  .bf-r-sssp { color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.7);
             background: linear-gradient(90deg, #ff5a5a, #ffb84d, #f2e85a, #5cd67f, #4db8ff, #a06bff);
             box-shadow: 0 0 0 1px rgba(255,255,255,0.85), 0 0 10px rgba(255,255,255,0.5); }
               background: linear-gradient(90deg, #ff5a5a, #ffb84d, #f2e85a, #5cd67f, #4db8ff, #a06bff); }
  .bf-r-sssp { box-shadow: 0 0 0 1px rgba(255,255,255,0.85), 0 0 10px rgba(255,255,255,0.5); }
  .bf-kind { background: rgba(255,255,255,0.16); color: #fff; }

  .bf-version-band { text-align: center; font-size: 0.68rem; font-weight: 800; padding: 3px 6px;
    color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
  .bf-version-band img { max-width: 100%; max-height: 1.2rem; object-fit: contain; }

  /* ============ POPUP ============ */
  .bf-dialog { width: min(480px, calc(100vw - 2rem)); padding: 0; border: 1px solid #232326;
    border-radius: 14px; background: #0e0e10; color: #fff; font-family: sans-serif; }
  .bf-dialog::backdrop { background: rgba(0,0,0,0.6); }
  .bf-dlg { position: relative; padding: 1.1rem; }
  .bf-dlg-x { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; background: transparent; border: none;
    color: #cfcfcf; cursor: pointer; }
  .bf-dlg-x:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .bf-dlg-head { display: flex; gap: 0.9rem; align-items: flex-start; margin-bottom: 0.85rem; padding-right: 26px; }
  .bf-dlg-art { width: 116px; height: 116px; object-fit: cover; border-radius: 8px; flex-shrink: 0;
    box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
  .bf-dlg-info { min-width: 0; }
  .bf-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 0.5rem; }
  .bf-chip { font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 5px;
    background: #1c1c1f; color: #cfcfcf; border: 1px solid #2c2c30; }
  .bf-chip-version { border: none; color: #fff; }
  .bf-chip-diff { background: var(--diff); color: #fff; border: none; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); }
  .bf-dlg-title { margin: 0 0 0.3rem; font-size: 1.25rem; font-weight: 800; overflow-wrap: anywhere; }
  .bf-dlg-artist { margin: 0; font-size: 0.8rem; color: #9a9a9e; }
  .bf-dlg-artist + .bf-dlg-artist { margin-top: 0.8rem; }
  .bf-divider { height: 1px; background: #232326; margin: 0.85rem 0; }
  .bf-score { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 0 0.4rem; }
  .bf-rank-pill { font-size: 0.85rem; font-weight: 800; padding: 4px 12px; border-radius: 999px; }
  .bf-big { font-size: 1.8rem; font-weight: 800; font-variant-numeric: tabular-nums; }
  .bf-big small { font-size: 1.02rem; color: #b7b7bb; font-weight: 700; }
  .bf-dxscore { margin: 0 0 0.25rem; font-size: 0.85rem; color: #cfcfcf; font-variant-numeric: tabular-nums; }
  .bf-dlg-meta { margin: 0 0 0.2rem; font-size: 0.75rem; color: #7a7a7e; }
  .bf-next { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; margin: 0.6rem 0 0.2rem;
    padding: 8px 10px; border-radius: 9px; background: #16161a; border: 1px solid #232326; font-size: 0.8rem; color: #cfcfcf; }
  .bf-next-label { color: #9a9a9e; font-weight: 700; }
  .bf-next-need, .bf-next-rating { font-variant-numeric: tabular-nums; }
  .bf-next-gain { font-weight: 800; color: #82ff9f; font-variant-numeric: tabular-nums; }
  .bf-next-max { color: #9a9a9e; font-style: italic; }
  .bf-icon-row { display: flex; gap: 10px; margin-top: 0.6rem; }
  .bf-icon-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;
    border-radius: 9px; background: #19191c; border: 1px solid #2a2a2e; color: #e5484d; }
  .bf-icon-btn:hover { background: #212124; }

  .bf-card-badges { position: absolute; top: 0px; left: 3px; display: flex; gap: 3px; }
  .bf-card-badges img { height: 38px; width: auto; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }

  .bf-dlg-badges { display: inline-flex; gap: 6px; align-items: center; }
  .bf-dlg-badges img { height: 38px; width: auto; }

  .bf-rank-img { height: 26px; width: auto; flex-shrink: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }
  .bf-dlg-rank-img { height: 34px; width: auto; }

  @media (max-width: 600px) {
    .bf-wrap { padding: 0 0.5rem 1rem 0.5rem; }
    .bf-section { flex-wrap: wrap; }
    .bf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
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
// one class per rank, so the color can build up from pink/red through gold to rainbow
const RANK_TONE: Record<string, string> = {
    A: 'r-a', AA: 'r-aa', AAA: 'r-aaa',
    S: 'r-s', 'S+': 'r-sp', SS: 'r-ss', 'SS+': 'r-ssp',
    SSS: 'r-sss', 'SSS+': 'r-sssp',
};
function rankTone(rank: string | undefined) {
    return (rank && RANK_TONE[rank]) || 'none';
}

// normalizes ap / fc into one of: fc, fcplus, ap, applus
function comboInfo(song: Song): { label: string; tier: 'fc' | 'fcplus' | 'ap' | 'applus' } | null {
    const raw = (song.fc || (song.ap ? 'ap' : '')).toLowerCase().replace(/[^a-z]/g, '');
    const map: Record<string, { label: string; tier: 'fc' | 'fcplus' | 'ap' | 'applus' }> = {
        fc: { label: 'FC', tier: 'fc' },
        fcplus: { label: 'FC+', tier: 'fcplus' },
        ap: { label: 'AP', tier: 'ap' },
        app: { label: 'AP+', tier: 'applus' },
        applus: { label: 'AP+', tier: 'applus' },
    };
    return map[raw] ?? null;
}

function syncInfo(song: Song): { label: string; tier: SyncTier } | null {
    const raw = (song.fs || '').toLowerCase().replace(/[^a-z]/g, '');
    const map: Record<string, { label: string; tier: SyncTier }> = {
        sync: { label: 'SYNC', tier: 'sync' },
        fs: { label: 'FS', tier: 'fs' },
        fsplus: { label: 'FS+', tier: 'fsplus' },
        fdx: { label: 'FDX', tier: 'fdx' },
        fdxplus: { label: 'FDX+', tier: 'fdxplus' },
    };
    return map[raw] ?? null;
}

// rough color per chart version name; extend as new versions show up in your data
function versionColor(version?: string): string {
    const v = (version ?? '').toUpperCase();
    if (v.includes('PLUS')) return '#c94fa0';
    if (v.includes('MAGIC')) return '#3ab6a0';
    if (v.includes('CIRCLE')) return '#ec6fc0';
    return '#6b6b70';
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
function Badges({ song, className }: { song: Song; className: string }) {
    const combo = comboInfo(song);
    const sync = syncInfo(song);
    const comboSrc = combo ? COMBO_BADGES[combo.tier] : null;
    const syncSrc = sync ? SYNC_BADGES[sync.tier] : null;
    if (!comboSrc && !syncSrc) return null;

    return (
        <span className={className}>
            {comboSrc && <img src={comboSrc} alt={combo!.label} title={combo!.label} />}
            {syncSrc && <img src={syncSrc} alt={sync!.label} title={sync!.label} />}
        </span>
    );
}

// "SSS+" -> https://img.himaimai.net/badges/sssp.png
function rankImage(rank: string) {
    return `${BADGE_BASE}/${rank.toLowerCase().replace(/\+/g, 'p')}.png`;
}

// grade image, falling back to the old colored text pill if the image is missing
function RankBadge({ rank, className }: { rank: string | undefined; className: string }) {
    const [broken, setBroken] = useState(false);

    if (!rank || broken) {
        return <span className={`bf-tag bf-${rankTone(rank)}`}>{rank ?? '-'}</span>;
    }

    return (
        <img
            src={rankImage(rank)}
            alt={rank}
            title={rank}
            className={className}
            onError={() => setBroken(true)}
        />
    );
}

function SongCard({ song, position, onOpen }: { song: Song; position: number; onOpen: () => void }) {
    const diff = diffOf(song.difficulty);
    const rank = rankFor(song.achievement)?.rank;
    const isDx = /dx/i.test(song.kind ?? '');
    const hasArt = Boolean(song.jacket_blob || song.jacket);
    const combo = comboInfo(song);
    const isRemaster = (song.difficulty ?? '').toLowerCase().replace(/[^a-z]/g, '') === 'remaster';

    return (
        <li>
            <button
                type="button"
                className="bf-card"
                style={{ '--diff': diff.color } as CSSProperties}
                onClick={onOpen}
                title={`#${position} ${song.title}`}
            >
                <span className="bf-art-wrap">
                    {hasArt && <FallbackImage src={song.jacket_blob} fallbackSrc={song.jacket} alt="" className="bf-art" />}
                    <span className="bf-dim" aria-hidden="true" />
                    <Badges song={song} className="bf-card-badges" />
                    <span className={`bf-level-badge${isRemaster ? ' bf-level-remaster' : ''}`}>{song.internal_difficulty?.toFixed(1)}</span>
                    <span className="bf-overlay">
                        <span className="bf-row">
                            <span className="bf-rating">{song.rating}</span>
                            <RankBadge rank={rank} className="bf-rank-img" />
                        </span>
                        <span className="bf-ach">{song.achievement == null ? '-' : `${song.achievement.toFixed(4)}%`}</span>
                        <span className="bf-row">
                            <span className="bf-title" title={song.title}>{song.title}</span>
                            <span className="bf-tag bf-kind">{isDx ? 'DX' : 'STD'}</span>
                        </span>
                    </span>
                </span>
                {song.version && (
                    <span className="bf-version-band" style={{ background: versionColor(song.version) }}>{song.version}</span>
                )}
            </button>
        </li>
    );
}

// passes a click handler down, and reports which card was opened
function Section({ title, note, songs, onOpen }: { title: string; note: string; songs: Song[]; onOpen: (s: Selected) => void }) {

    return (
        <section>
            <div className="bf-section">
                <h2>{title}</h2>
                <span>{note}</span>
                <StatsBadge title={title} songs={songs} />
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
    const [whole, decimals] = song ? song.achievement.toFixed(4).split('.') : ['', ''];
    const combo = song ? comboInfo(song) : null;
    const sync = song ? syncInfo(song) : null;
    const art = song?.jacket_blob || song?.jacket;
    const hasDxScore = song && song.dx_score != null && song.dx_max != null && song.dx_max > 0;
    const dxPct = hasDxScore ? ((song!.dx_score! / song!.dx_max!) * 100).toFixed(2) : null;
    const next = song ? nextRankInfo(song) : null;
    const searchUrl = song
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} maimai ${diff?.label ?? ''}`)}`
        : '#';

    return (
        <dialog
            ref={ref}
            className="bf-dialog"
            aria-label="Song details"
            onClose={onClose}
            onClick={(e) => { if (e.target === ref.current) onClose(); }}
        >
            {entry && song && diff && (
                <div className="bf-dlg" key={`${song.difficulty}-${song.kind}-${song.title}`} style={{ '--diff': diff.color } as CSSProperties}>
                    <button type="button" className="bf-dlg-x" onClick={onClose} aria-label="Close">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M5 5l14 14M19 5L5 19" />
                        </svg>
                    </button>

                    <div className="bf-dlg-head">
                        {art && <FallbackImage src={song.jacket_blob} fallbackSrc={song.jacket} alt="" className="bf-dlg-art" width={116} height={116} />}
                        <div className="bf-dlg-info">
                            <div className="bf-chips">
                                {song.version && (
                                    <span className="bf-chip bf-chip-version" style={{ background: versionColor(song.version) }}>{song.version}</span>
                                )}
                                <span className="bf-chip">{/dx/i.test(song.kind ?? '') ? 'DX' : 'STD'}</span>
                                <span className="bf-chip bf-chip-diff">{diff.label} {song.internal_difficulty?.toFixed(1)}</span>
                            </div>
                            <h3 className="bf-dlg-title">{song.title}</h3>
                            {song.artist && <p className="bf-dlg-artist">{song.artist}</p>}
                            {song.bpm && <p className="bf-dlg-artist">{song.bpm} BPM</p>}
                        </div>
                    </div>

                    <div className="bf-divider" />

                    <div className="bf-score">
                        <RankBadge rank={cutoff?.rank} className="bf-dlg-rank-img" />
                        <span className="bf-big">{whole}.<small>{decimals}%</small></span>
                        <Badges song={song} className="bf-dlg-badges" />
                    </div>
                    {hasDxScore && (
                        <p className="bf-dxscore">{song.dx_score!.toLocaleString()} / {song.dx_max!.toLocaleString()} ({dxPct}%)</p>
                    )}
                    <p className="bf-dlg-meta"><b>{song.rating} rating</b></p>
                    <p className="bf-dlg-meta">{entry.list}: #{entry.position} of {entry.size}</p>

                    {next ? (
                        <div className="bf-next" title="Rating at exactly the next rank's cutoff. Since this chart is in your best 50, the gain adds straight to your total rating.">
                            <span className="bf-next-label">Next rank</span>
                            <span className={`bf-rank-pill bf-${rankTone(next.rank)}`}>{next.rank}</span>
                            <span className="bf-next-need">at {next.at.toFixed(4)}% (+{(next.at - song.achievement).toFixed(4)}%)</span>
                            <span className="bf-next-rating">→ {next.rating} rating</span>
                            <span className="bf-next-gain">{next.gain > 0 ? `+${next.gain}` : '+0'}</span>
                        </div>
                    ) : cutoff && (
                        <div className="bf-next"><span className="bf-next-max">Max rank reached, no more rating to gain from this chart</span></div>
                    )}

                    <div className="bf-icon-row">
                        {/* keep your three <a className="bf-icon-btn"> links (YouTube, mai-notes, MV) exactly as they were */}
                    </div>
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

            <Section title="B15" note="new songs (CiRCLE PLUS and CiRCLE)" songs={b15} onOpen={setSelected} />

            <hr className="divider" />

            <Section title="B35" note="old songs (PRiSM PLUS and below)" songs={b35} onOpen={setSelected} />

            <SongDetail entry={selected} onClose={() => setSelected(null)} />
        </div>
    );
}