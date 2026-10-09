'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import type { Song } from '../lib/leaderboard';
import { new15, old35, rankFor, rateSong, RANK_CUTOFFS } from '../lib/song-calc';
import FallbackImage from './FallbackImage';
import { StatsBadge } from './StatsBadge';
import { VERSION_NAMES } from '../lib/versions';

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

const NAMES = Object.values(VERSION_NAMES)

// how long a chart counts as "new" after it improves
const NEW_DAYS = 1;

const COMBO_LABELS: Record<string, string> = { fc: 'FC', fcplus: 'FC+', ap: 'AP', applus: 'AP+' };
const SYNC_LABELS: Record<string, string> = { sync: 'SYNC', fs: 'FS', fsplus: 'FS+', fdx: 'FDX', fdxplus: 'FDX+' };

/**
 * Did this chart improve recently, and what changed?
 * The scraper stamps improved_at / improved / prev_achievement / prev_fc
 * whenever a chart gets a first play, a higher score, or a better badge.
 */
function improvementInfo(song: Song) {
    if (!song.improved_at || !song.improved?.length) return null;

    const at = new Date(song.improved_at);
    const ageDays = (Date.now() - at.getTime()) / 86_400_000;
    if (!Number.isFinite(ageDays) || ageDays > NEW_DAYS) return null;

    const isFirst = song.improved.includes('first');
    const prevFc = song.prev_fc ?? null;

    // a short description for the popup, e.g. "99.8123% → 100.2045%, FC → AP"
    const parts: string[] = [];
    if (isFirst) parts.push('first play');
    if (song.improved.includes('score') && song.prev_achievement != null) {
        parts.push(`${song.prev_achievement.toFixed(4)}% → ${song.achievement.toFixed(4)}%`);
    }
    if (song.improved.includes('combo')) {
        parts.push(`${COMBO_LABELS[prevFc ?? ''] ?? 'no combo'} → ${COMBO_LABELS[song.fc ?? ''] ?? '?'}`);
    }
    if (song.improved.includes('sync')) {
        parts.push(`new ${SYNC_LABELS[song.fs ?? ''] ?? 'sync'}`);
    }

    return { at, isFirst, detail: parts.join(', ') };
}

// total rating from a list of charts: best 15 new + best 35 old, each rating rounded down
function b50Total(list: Song[]) {
    const sum = (l: Song[]) => l.reduce((t, s) => t + Math.floor(s.rating), 0);
    return sum(new15(list)) + sum(old35(list));
}

/**
 * How much each recent improvement added to the player's total rating.
 *
 * For every improved chart, the B50 is worked out again with that one chart
 * put back the way it was (old score and old combo badge, or removed entirely
 * for a first play). The difference is what the improvement was worth. A chart
 * that didn't make the B50 comes out as 0, and an improvement that pushed
 * another chart out only counts what it gained over the chart it replaced.
 */
export function ratingGains(songs: Song[]): Map<string, number> {
    const gains = new Map<string, number>();
    const improved = songs.filter((s) => improvementInfo(s));
    if (improved.length === 0) return gains;

    const current = b50Total(songs);

    for (const s of improved) {
        const key = chartKey(s);
        const isFirst = s.improved?.includes('first') || s.prev_achievement == null;
        const prevFc = s.prev_fc ?? null;

        const reverted = isFirst
            ? songs.filter((x) => chartKey(x) !== key)
            : songs.map((x) => chartKey(x) !== key ? x : ({
                ...x,
                achievement: s.prev_achievement as number,
                fc: prevFc,
                ap: prevFc === 'ap' || prevFc === 'applus',
                app: prevFc === 'applus',
                rating: undefined, // make new15 / old35 rate it again at the old score
            } as unknown as Song));

        gains.set(key, Math.max(0, current - b50Total(reverted)));
    }

    return gains;
}

// exported so the favorite scores row can draw the same cards
export const bestFiftyCss = `
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

  /* top-right corner: the level badge, with the "new" banner hanging underneath it */
  .bf-corner { position: absolute; top: 0; right: 0; display: flex; flex-direction: column;
    align-items: flex-end; gap: 3px; }

  /* top-right badge: the chart's difficulty value, in the difficulty color */
  .bf-level-badge { padding: 5px 10px 5px 12px;
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

  .bf-next-rank-img { height: 24px; width: auto; flex-shrink: 0; }

  .bf-card-badges { position: absolute; top: 0; left: 3px; display: flex; gap: 3px; isolation: isolate; }
  .bf-card-badges img { height: 38px; width: auto;
    filter: drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.85)); }

  .bf-card-badges::before { content: ''; position: absolute; z-index: -1; inset: -4px -24px -18px -8px;
    background: radial-gradient(ellipse at top left, rgba(0,0,0,0.6), transparent 70%); pointer-events: none; }

  .bf-card-badges img { height: 38px; width: auto;
    filter: saturate(1.15) brightness(1.05)
          drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.85)); }

  .bf-rank-img { height: 26px; width: auto; flex-shrink: 0;
    filter: drop-shadow(0 0 1px rgba(255,255,255,0.8)) drop-shadow(0 2px 3px rgba(0,0,0,0.85)); }

  .bf-dlg-badges img, .bf-dlg-rank-img { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6)); }

  @media (max-width: 600px) {
    .bf-wrap { padding: 0 0.5rem 1rem 0.5rem; }
    .bf-section { flex-wrap: wrap; }
    .bf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
  }

  /* expand / collapse button for the tied charts */
  .bf-extra-toggle { display: flex; align-items: center; gap: 6px; margin: 0.75rem auto 0; padding: 6px 14px;
    border-radius: 999px; border: 1px solid var(--border-light); background: transparent;
    color: var(--text-sub); font: inherit; font-size: 0.8rem; cursor: pointer; }
  .bf-extra-toggle:hover { color: #2563eb; border-color: #2563eb; }
  .bf-extra-chev { display: inline-block; transition: transform 0.2s ease; }
  .bf-extra-chev.open { transform: rotate(180deg); }
  .bf-extra-note { margin: 0.6rem 0; text-align: center; font-size: 0.75rem; color: var(--text-muted); }

  /* recently improved charts: a ring around the card and a banner under the level badge */
  .bf-new { background: linear-gradient(135deg, #ff4d8d, #ff8a3d); color: #fff;
    text-shadow: 0 1px 1px rgba(0,0,0,0.35); box-shadow: 0 0 6px rgba(255,90,120,0.6);
    font-variant-numeric: tabular-nums; }
  .bf-card-new { box-shadow: 0 0 0 2px #ff5a87, 0 0 10px rgba(255,90,135,0.45); }
  .bf-card-new:hover { box-shadow: 0 0 0 2px #ff5a87, 0 4px 14px rgba(255,90,135,0.55); }
  .bf-new-banner { padding: 2px 4px 2px 6px; border-radius: 8px 0 0 8px; font-size: 0.62rem; font-weight: 800;
    letter-spacing: 0.04em; line-height: 1.3; white-space: nowrap; }
  .bf-dlg-new { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; margin: 0.5rem 0 0.2rem;
    font-size: 0.8rem; color: #cfcfcf; font-variant-numeric: tabular-nums; }
  .bf-dlg-new-date { color: #7a7a7e; margin-left: auto; }

  /* tied charts: dimmed so they read as "not counted", brighter on hover so they're still easy to look at */
  .bf-card-muted { opacity: 0.45; transition: opacity 0.15s ease; }
  .bf-card-muted:hover, .bf-card-muted:focus-visible { opacity: 0.85; }
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
export type Selected = { song: Song; position: number; list: string; size: number };

// next rank up, and what the song would rate at exactly that achievement
function nextRankInfo(song: Song) {
    const current = RANK_CUTOFFS.find((c) => song.achievement >= c.min);
    if (!current) return null; // no rank yet
    // where the next rank up starts: the lowest real (non-edge) row with a different,
    // higher rank. edge rows (100.4999 and so on) and D's lower steps aren't new ranks
    const next = RANK_CUTOFFS
        .filter((c) => !c.edge && c.min > song.achievement && c.rank !== current.rank)
        .at(-1);
    if (!next) return null; // already at the top rank
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

export function SongCard({ song, position, onOpen, muted = false, gain = 0, itemProps, onCardKeyDown, children }: {
    song: Song;
    position: number;
    onOpen: () => void;
    muted?: boolean;
    gain?: number;
    // extras for the favorites editor (the best 50 uses none of these): attributes and
    // handlers for the card's <li>, a key handler for the card itself, and anything
    // drawn on top of it (like a remove button)
    itemProps?: HTMLAttributes<HTMLLIElement> & { 'data-key'?: string };
    onCardKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
    children?: ReactNode;
}) {
    const diff = diffOf(song.difficulty);
    const rank = rankFor(song.achievement)?.rank;
    const isDx = /dx/i.test(song.kind ?? '');
    const hasArt = Boolean(song.jacket_blob || song.jacket);
    const isRemaster = (song.difficulty ?? '').toLowerCase().replace(/[^a-z]/g, '') === 'remaster';
    const improvement = improvementInfo(song);

    return (
        <li {...itemProps}>
            <button
                type="button"
                className={`bf-card${muted ? ' bf-card-muted' : ''}${improvement ? ' bf-card-new' : ''}`}
                style={{ '--diff': diff.color } as CSSProperties}
                onClick={onOpen}
                onKeyDown={onCardKeyDown}
                title={`#${position} ${song.title}`}
            >
                <span className="bf-art-wrap">
                    {hasArt && <FallbackImage src={song.jacket_blob} fallbackSrc={song.jacket} alt="" className="bf-art" />}
                    <span className="bf-dim" aria-hidden="true" />
                    <Badges song={song} className="bf-card-badges" />
                    <span className="bf-corner">
                        <span className={`bf-level-badge${isRemaster ? ' bf-level-remaster' : ''}`}>{song.internal_difficulty?.toFixed(1)}</span>
                        {improvement && (
                            <span className="bf-new bf-new-banner" title={improvement.detail}>
                                New PB! (+{gain})
                            </span>
                        )}
                    </span>
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
            {children}
        </li>
    );
}

// passes a click handler down, and reports which card was opened
function Section({ title, note, songs, extras, floor, gains, onOpen }: {
    title: string; note: string; songs: Song[]; extras: Song[]; floor: number | null;
    gains: Map<string, number>;
    onOpen: (s: Selected) => void;
}) {
    const [showExtras, setShowExtras] = useState(false);

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
                            key={chartKey(song)}
                            song={song}
                            position={i + 1}
                            gain={gains.get(chartKey(song))}
                            onOpen={() => onOpen({ song, position: i + 1, list: title, size: songs.length })}
                        />
                    ))}
                </ul>
            )}

            {extras.length > 0 && (
                <>
                    <button
                        type="button"
                        className="bf-extra-toggle"
                        aria-expanded={showExtras}
                        onClick={() => setShowExtras((v) => !v)}
                    >
                        {showExtras ? 'hide' : 'show'} {extras.length} more chart{extras.length === 1 ? '' : 's'} tied at the floor ({floor})
                        <span className={`bf-extra-chev${showExtras ? ' open' : ''}`} aria-hidden="true">▾</span>
                    </button>

                    {showExtras && (
                        <>
                            <p className="bf-extra-note">
                                these scores tie your {title} floor but don't count toward your rating
                            </p>
                            <ul className="bf-grid">
                                {extras.map((song, i) => (
                                    <SongCard
                                        key={chartKey(song)}
                                        song={song}
                                        position={i + 1}
                                        muted
                                        gain={gains.get(chartKey(song))}
                                        onOpen={() => onOpen({
                                            song,
                                            position: i + 1,
                                            list: `${title} ties (not counted)`,
                                            size: extras.length,
                                        })}
                                    />
                                ))}
                            </ul>
                        </>
                    )}
                </>
            )}
        </section>
    );
}

// The popup, using the browser's built-in <dialog> (Esc closes it, focus is handled for you)
export function SongDetail({ entry, gains, onClose }: {
    entry: Selected | null; gains: Map<string, number>; onClose: () => void;
}) {
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
    const hasAp = combo?.tier === 'ap' || combo?.tier === 'applus' || Boolean(song?.ap);
    const improvement = song ? improvementInfo(song) : null;
    const gain = song ? gains.get(chartKey(song)) ?? 0 : 0;
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

                    {improvement && (
                        <div className="bf-dlg-new">
                            <span className="bf-tag bf-new" title={`Added ${gain} to their total rating`}>
                                New PB! (+{gain})
                            </span>
                            <span>{improvement.detail}</span>
                            <span className="bf-dlg-new-date">
                                {improvement.at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                    )}

                    {next ? (
                        <div className="bf-next" title="Rating at exactly the next rank's cutoff. Since this chart is in your best 50, the gain adds straight to your total rating.">
                            <span className="bf-next-label">Next rank</span>
                            <RankBadge rank={next.rank} className="bf-next-rank-img" />
                            <span className="bf-next-need">at {next.at.toFixed(4)}% (+{(next.at - song.achievement).toFixed(4)}%)</span>
                            <span className="bf-next-rating">→ {next.rating} rating</span>
                            <span className="bf-next-gain">{next.gain > 0 ? `+${next.gain}` : '+0'}</span>
                        </div>
                    ) : cutoff && (
                        hasAp ? (
                            <div className="bf-next">
                                <span className="bf-next-max">Max rank reached, no more rating to gain from this chart</span>
                            </div>
                        ) : (
                            <div className="bf-next" title="An AP or AP+ adds a 1 rating bonus to this chart. Since it's in your best 50, it adds straight to your total.">
                                <span className="bf-next-label">Next</span>
                                <span className="bf-next-need">AP or AP+</span>
                                <span className="bf-next-rating">→ {song.rating + 1} rating</span>
                                <span className="bf-next-gain">+1</span>
                            </div>
                        )
                    )}

                    <div className="bf-icon-row">
                        {/* keep your three <a className="bf-icon-btn"> links (YouTube, mai-notes, MV) exactly as they were */}
                    </div>
                </div>
            )}
        </dialog>
    );
}

export const chartKey = (s: Song) => `${s.difficulty}-${s.kind}-${s.title}`;

// every chart in the same pool that ties the list's lowest rating but didn't make the cut
function tiedAtFloor(all: Song[], counted: Song[], inPool: (s: Song) => boolean) {
    if (counted.length === 0) return { floor: null, extras: [] as Song[] };

    const countedKeys = new Set(counted.map(chartKey));
    const floor = Math.min(...counted.map((s) => Math.floor(s.rating)));

    const extras = all
        .filter((s) => inPool(s) && !countedKeys.has(chartKey(s)))
        // raw songs don't carry a rating yet; work it out the same way new15 / old35 do
        .map((s) => ({ ...s, rating: s.rating ?? rateSong(s) }))
        .filter((s) => Math.floor(s.rating) === floor);

    return { floor, extras };
}

export default function BestFifty({ data }: { data?: Song[] | null }) {
    const [selected, setSelected] = useState<Selected | null>(null);
    const songs = data ?? [];
    const b15 = new15(songs);
    const b35 = old35(songs);

    const b15Ties = tiedAtFloor(songs, b15, (s) => Boolean(s.new_pool));
    const b35Ties = tiedAtFloor(songs, b35, (s) => !s.new_pool);
    const gains = ratingGains(songs);

    return (
        <div className="bf-wrap">
            <style>{bestFiftyCss}</style>

            <Section title="B15" note={`new songs (${NAMES[NAMES.length - 1]} and ${NAMES[NAMES.length - 2]})`} songs={b15}
                extras={b15Ties.extras} floor={b15Ties.floor} gains={gains} onOpen={setSelected} />

            <hr className="divider" />

            <Section title="B35" note={`old songs (${NAMES[NAMES.length - 3]} and below)`} songs={b35}
                extras={b35Ties.extras} floor={b35Ties.floor} gains={gains} onOpen={setSelected} />

            <SongDetail entry={selected} gains={gains} onClose={() => setSelected(null)} />
        </div>
    );
}