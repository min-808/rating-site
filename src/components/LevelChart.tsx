'use client';

import { useState } from 'react';
import { useChartRegion, setChartRegion } from './chart-region';
import type { Song } from '../lib/leaderboard';
import { toNormalWidth } from '../lib/leaderboard';

/**
 * One bar per level ("13+", "14", ...), split into how far the player has
 * taken their charts at that level. Every bar is the same width; the segments
 * show what share of that level's charts reached each rank (or combo), and the
 * dark remainder is what they haven't played yet. Two views: rank and combo
 * (played / FC / FC+ / AP / AP+).
 *
 * A level is "lamped" once every chart at it has been played with at least an A
 * (80%, a pass). The lamp shows the worst result across the folder, so it climbs
 * as they improve: A, AA, AAA, S, SS, SSS, SSS+ in the rank view, and A (all
 * passed), FC, FC+, AP, AP+ in the combo view.
 *
 * Each level also shows "+N" when the latest nightly scrape found N charts
 * there that the player had never played before.
 *
 * Two regions: NA leaves out songs that aren't available in North America
 * (marked na "0" in the songs collection), from both the totals and the
 * played counts. Intl counts everything the international version has.
 */

type Segment = { key: string; label: string; color: string };
type View = 'rank' | 'combo';

const COMBO_SEGMENTS: Segment[] = [
    { key: 'played', label: 'Played', color: '#4b8f6a' },
    { key: 'fc', label: 'FC', color: '#3d84c9' },
    { key: 'fcplus', label: 'FC+', color: '#1f9e86' },
    { key: 'ap', label: 'AP', color: '#e08a2e' },
    { key: 'applus', label: 'AP+', color: '#d94f9c' },
];

// worst to best, left to right. colors match the rank tags on the score cards
const RANK_SEGMENTS: Segment[] = [
    { key: 'belowa', label: 'Below A', color: '#6b4a55' },
    { key: 'a', label: 'A', color: '#f4a7bd' },
    { key: 'aa', label: 'AA', color: '#e0527f' },
    { key: 'aaa', label: 'AAA', color: 'linear-gradient(135deg, #d92d4a, #e8407a)' },
    { key: 's', label: 'S / S+', color: '#d9b45a' },
    { key: 'ss', label: 'SS / SS+', color: '#f5c531' },
    { key: 'sss', label: 'SSS', color: '#fff0a0' },
    { key: 'sssp', label: 'SSS+', color: 'linear-gradient(90deg, #ff5a5a, #ffb84d, #f2e85a, #5cd67f, #4db8ff, #a06bff)' },
];

// same title matching as the scrapers, so full-width titles line up
const titleKey = (title: string) => toNormalWidth(String(title ?? '')).replace(/\s+/g, ' ').trim().toLowerCase();

function comboKey(song: Song): string {
    const raw = (song.fc || (song.ap ? 'ap' : '')).toLowerCase().replace(/[^a-z]/g, '');
    if (raw === 'applus' || raw === 'app') return 'applus';
    if (raw === 'ap') return 'ap';
    if (raw === 'fcplus') return 'fcplus';
    if (raw === 'fc') return 'fc';
    return 'played';
}

// maimai's rank cutoffs: A 80%, AA 90%, AAA 94%, S 97%, SS 99%, SSS 100%, SSS+ 100.5%
function rankKey(song: Song): string {
    const a = song.achievement ?? 0;
    if (a >= 100.5) return 'sssp';
    if (a >= 100) return 'sss';
    if (a >= 99) return 'ss';
    if (a >= 97) return 's';
    if (a >= 94) return 'aaa';
    if (a >= 90) return 'aa';
    if (a >= 80) return 'a';
    return 'belowa';
}

// what a folder's lamp says, by the worst result in it. below A means no lamp at all
type Lamp = { label: string; color: string; text: string; title: string };
const RANK_ORDER = RANK_SEGMENTS.map((s) => s.key);
const COMBO_ORDER = COMBO_SEGMENTS.map((s) => s.key);

// short labels keep the lamp slot narrow, which matters on phones.
// the pass-level lamps use the same colors as their rank segments in the bars
const PASS_LAMP = { label: 'A', color: '#f4a7bd', text: '#4a0f22', what: 'A or better' };
const RANK_LAMPS: Record<string, typeof PASS_LAMP> = {
    a: PASS_LAMP,
    aa: { label: 'AA', color: '#e0527f', text: '#fff', what: 'AA or better' },
    aaa: { label: 'AAA', color: 'linear-gradient(135deg, #d92d4a, #e8407a)', text: '#fff', what: 'AAA or better' },
    s: { label: 'S', color: '#d9b45a', text: '#3b2a00', what: 'S or better' },
    ss: { label: 'SS', color: '#f5c531', text: '#3b2500', what: 'SS or better' },
    sss: { label: 'SSS', color: '#fff0a0', text: '#4a3200', what: 'SSS or better' },
    sssp: {
        label: 'SSS+', text: '#fff', what: 'SSS+',
        color: 'linear-gradient(90deg, #ff5a5a, #ffb84d, #f2e85a, #5cd67f, #4db8ff, #a06bff)',
    },
};
const COMBO_LAMPS: Record<string, typeof PASS_LAMP> = {
    played: PASS_LAMP,
    fc: { label: 'FC', color: '#3d84c9', text: '#fff', what: 'FC or better' },
    fcplus: { label: 'FC+', color: '#1f9e86', text: '#fff', what: 'FC+ or better' },
    ap: { label: 'AP', color: '#e08a2e', text: '#fff', what: 'AP or better' },
    applus: { label: 'AP+', color: '#d94f9c', text: '#fff', what: 'AP+' },
};

const SEGMENTS_BY_VIEW: Record<View, Segment[]> = { rank: RANK_SEGMENTS, combo: COMBO_SEGMENTS };
const KEY_BY_VIEW: Record<View, (song: Song) => string> = { rank: rankKey, combo: comboKey };

// how long a first play counts as "new" on the chart. the scrape runs nightly, so
// one day covers whatever the latest scrape found (same window as the NEW PB banners)
const NEW_DAYS = 1;

// levels below this (9+ and lower) are collapsed by default
const LOW_CUTOFF = 10;

// "13+" sorts just above "13" and below "14"
function levelValue(level: string): number {
    const n = parseFloat(level);
    return Number.isFinite(n) ? n + (level.trim().endsWith('+') ? 0.5 : 0) : -1;
}

const css = `
  .lc-wrap { margin: 0 0 2rem; }

  /* heading, toggles and legend are centered above the bars */
  .lc-head { display: flex; flex-direction: column; align-items: center; gap: 1.1rem; margin-bottom: 1.45rem;
    text-align: center; }
  .lc-head h2 { margin: 0.5rem 0 0; font-size: 2rem; }
  .lc-toggles { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 0.25rem 0; }
  .lc-toggle { display: inline-flex; border: 1px solid var(--border-light); border-radius: 6px; padding: 2px; }
  .lc-toggle button { border: 0; background: transparent; color: var(--text-sub); font: inherit; font-size: 0.8rem;
    padding: 4px 12px; border-radius: 4px; cursor: pointer; }
  .lc-toggle button.active { background: #2563eb; color: #fff; }
  .lc-toggle button:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }

  .lc-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; margin-bottom: 0.75rem;
    font-size: 0.75rem; color: var(--text-sub); }
  .lc-legend span { display: inline-flex; align-items: center; gap: 5px; }
  .lc-swatch { width: 14px; height: 10px; border-radius: 2px; display: inline-block; }

  .lc-rows { display: flex; flex-direction: column; gap: 4px; }
  .lc-row { display: grid; grid-template-columns: 2.6rem 1fr auto; align-items: center; gap: 10px; }
  .lc-level { text-align: right; font-size: 0.8rem; font-weight: 700; color: var(--text-sub);
    font-variant-numeric: tabular-nums; }
  .lc-track-area { min-width: 0; }
  .lc-track { display: flex; height: 14px; border-radius: 3px; overflow: hidden;
    background: rgba(127,127,127,0.18); }
  .lc-seg { height: 100%; flex-shrink: 0; }
  .lc-count { font-size: 0.72rem; color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }

  /* the right-hand column is three slots: lamp (left-aligned) | played / total | +new.
     every row has all three (empty when there's nothing to show), so everything
     lines up down the chart instead of shifting with the lamp */
  .lc-end { display: grid; grid-template-columns: 2.6rem auto 2rem; align-items: center; gap: 6px; }
  .lc-end-lamp { justify-self: start; display: flex; align-items: center; }
  /* played / total, right-aligned so every count ends at the same edge. the slot is
     just wide enough for the longest count ("409 / 409"), so it sits close to the lamp */
  .lc-end-count { min-width: 9ch; text-align: right; }
  .lc-new { font-size: 0.72rem; font-weight: 800; color: #4ade80; font-variant-numeric: tabular-nums;
    white-space: nowrap; text-align: left; }
  .lc-lamp { display: inline-block; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.03em; padding: 1px 6px;
    border-radius: 4px; line-height: 1.3; white-space: nowrap; text-shadow: 0 1px 1px rgba(0,0,0,0.25); }
  /* a lamped level's bar gets the same soft glow, whatever the lamp is */
  .lc-row-lamped .lc-track { box-shadow: 0 0 0 1px rgba(255, 214, 110, 0.9), 0 0 6px rgba(255, 214, 110, 0.6); }

  .lc-more { display: flex; align-items: center; gap: 6px; margin: 0.6rem auto 0; padding: 5px 14px;
    border-radius: 999px; border: 1px solid var(--border-light); background: transparent;
    color: var(--text-sub); font: inherit; font-size: 0.78rem; cursor: pointer; }
  .lc-more:hover { color: #2563eb; border-color: #2563eb; }
  .lc-chev { display: inline-block; transition: transform 0.2s ease; }
  .lc-chev.open { transform: rotate(180deg); }

  /* phones: tighter right-hand slots and slightly smaller text, so the bar keeps most of the row */
  @media (max-width: 600px) {
    .lc-row { grid-template-columns: 2.2rem 1fr auto; gap: 6px; }
    .lc-end { grid-template-columns: 2.2rem auto 1.5rem; gap: 4px; }
    .lc-count, .lc-new { font-size: 0.66rem; }
    .lc-lamp { font-size: 0.56rem; padding: 1px 4px; }
    .lc-track { height: 12px; }
  }
`;

export default function LevelChart({ songs, totals, naExcluded }: {
    songs: Song[];
    totals: { na: Record<string, number>; intl: Record<string, number> };
    naExcluded: string[]; // title keys of songs not available in North America
}) {
    const [view, setView] = useState<View>('rank');
    // shared with the rest of the profile, so "unique charts played" follows this toggle
    const region = useChartRegion();
    const setRegion = setChartRegion;
    const [showLow, setShowLow] = useState(false);
    const segments = SEGMENTS_BY_VIEW[view];
    const keyOf = KEY_BY_VIEW[view];
    const regionTotals = totals[region];
    const excluded = new Set(naExcluded);

    // played charts per level, split into the current view's segments.
    // in NA, songs not available there are left out, same as the totals
    const byLevel = new Map<string, Record<string, number>>();
    // the worst rank and combo seen at each level, for the lamp
    const worst = new Map<string, { rank: number; combo: number }>();
    // charts played for the first time in the latest scrape, per level
    const fresh = new Map<string, number>();
    const now = Date.now();
    for (const song of songs) {
        const level = String(song.level ?? '').trim();
        if (!level || !(song.achievement > 0)) continue;
        if (region === 'na' && excluded.has(titleKey(song.title))) continue;
        if (!byLevel.has(level)) byLevel.set(level, {});
        const counts = byLevel.get(level)!;
        const key = keyOf(song);
        counts[key] = (counts[key] ?? 0) + 1;

        const w = worst.get(level) ?? { rank: Infinity, combo: Infinity };
        w.rank = Math.min(w.rank, RANK_ORDER.indexOf(rankKey(song)));
        w.combo = Math.min(w.combo, COMBO_ORDER.indexOf(comboKey(song)));
        worst.set(level, w);

        // the score scraper marks a chart improved: ["first"] the night it's first played
        if (song.improved?.includes('first') && song.improved_at) {
            const ageDays = (now - new Date(song.improved_at).getTime()) / 86_400_000;
            if (ageDays >= 0 && ageDays <= NEW_DAYS) fresh.set(level, (fresh.get(level) ?? 0) + 1);
        }
    }

    // a level is lamped when every chart at it is played with at least an A (a pass)
    const lampFor = (level: string, played: number, total: number): Lamp | null => {
        const w = worst.get(level);
        if (!w || total === 0 || played < total) return null;
        const worstRank = RANK_ORDER[w.rank];
        if (!worstRank || worstRank === 'belowa') return null;

        const lamp = view === 'combo' ? COMBO_LAMPS[COMBO_ORDER[w.combo]] : RANK_LAMPS[worstRank];
        if (!lamp) return null;
        return {
            label: lamp.label,
            color: lamp.color,
            text: lamp.text,
            title: `Every chart at ${level} played with ${lamp.what}`,
        };
    };

    // every level that exists in the game or that they've played, highest first
    const levels = [...new Set([...Object.keys(regionTotals), ...byLevel.keys()])]
        .filter((l) => levelValue(l) >= 1)
        .sort((a, b) => levelValue(b) - levelValue(a));

    const rows = levels.map((level) => {
        const counts = byLevel.get(level) ?? {};
        const played = Object.values(counts).reduce((t, n) => t + n, 0);
        // never let played exceed the total, in case the two sources disagree slightly
        const total = Math.max(regionTotals[level] ?? 0, played);
        return { level, counts, played, total, lamp: lampFor(level, played, total), newCount: fresh.get(level) ?? 0 };
    });

    if (rows.length === 0) return null;

    // 10 and up are always shown; 9+ and below sit behind a toggle
    const highRows = rows.filter((r) => levelValue(r.level) >= LOW_CUTOFF);
    const lowRows = rows.filter((r) => levelValue(r.level) < LOW_CUTOFF);
    const lowPlayed = lowRows.reduce((t, r) => t + r.played, 0);
    const lowNew = lowRows.reduce((t, r) => t + r.newCount, 0);

    const renderRow = ({ level, counts, played, total, lamp, newCount }: (typeof rows)[number]) => (
        <div className={`lc-row${lamp ? ' lc-row-lamped' : ''}`} key={level}>
            <span className="lc-level">{level}</span>
            <div className="lc-track-area">
                {/* every bar is full width; segments show how much of this level is done */}
                <div className="lc-track">
                    {segments.map((seg) => {
                        const n = counts[seg.key] ?? 0;
                        if (n === 0) return null;
                        return (
                            <span
                                key={seg.key}
                                className="lc-seg"
                                style={{ width: `${(n / total) * 100}%`, background: seg.color }}
                                title={`Level ${level}: ${n} ${seg.label}`}
                            />
                        );
                    })}
                </div>
            </div>
            <span className="lc-end">
                <span className="lc-end-lamp">
                    {lamp && (
                        <span className="lc-lamp" style={{ background: lamp.color, color: lamp.text }} title={lamp.title}>
                            {lamp.label}
                        </span>
                    )}
                </span>
                <span className="lc-count lc-end-count">{played} / {total}</span>
                <span
                    className="lc-new"
                    title={newCount > 0 ? `${newCount} chart${newCount === 1 ? '' : 's'} played for the first time in the latest update` : undefined}
                >
                    {newCount > 0 ? `+${newCount}` : ''}
                </span>
            </span>
        </div>
    );

    return (
        <section className="lc-wrap">
            <style>{css}</style>

            <div className="lc-head">
                <h2>Level Breakdown</h2>
                <div className="lc-toggles">
                    <div className="lc-toggle" role="group" aria-label="Breakdown">
                        <button type="button" className={view === 'rank' ? 'active' : ''} aria-pressed={view === 'rank'}
                            onClick={() => setView('rank')}>rank</button>
                        <button type="button" className={view === 'combo' ? 'active' : ''} aria-pressed={view === 'combo'}
                            onClick={() => setView('combo')}>combo</button>
                    </div>
                    <div className="lc-toggle" role="group" aria-label="Region">
                        <button type="button" className={region === 'na' ? 'active' : ''} aria-pressed={region === 'na'}
                            onClick={() => setRegion('na')}
                            title="The international version, with a handful of excluded songs">na</button>
                        <button type="button" className={region === 'intl' ? 'active' : ''} aria-pressed={region === 'intl'}
                            onClick={() => setRegion('intl')}
                            title="Every song in the international version of Maimai">international</button>
                    </div>
                </div>
            </div>

            <div className="lc-legend">
                {segments.map((seg) => (
                    <span key={seg.key}><i className="lc-swatch" style={{ background: seg.color }} />{seg.label}</span>
                ))}
                <span><i className="lc-swatch" style={{ background: 'rgba(127,127,127,0.18)' }} />Not played</span>
            </div>

            <div className="lc-rows">
                {highRows.map(renderRow)}
                {showLow && lowRows.map(renderRow)}
            </div>

            {lowRows.length > 0 && (
                <button
                    type="button"
                    className="lc-more"
                    aria-expanded={showLow}
                    onClick={() => setShowLow((v) => !v)}
                >
                    {showLow ? 'hide' : 'show'} level 9+ and below ({lowPlayed} played{lowNew > 0 ? `, +${lowNew} new` : ''})
                    <span className={`lc-chev${showLow ? ' open' : ''}`} aria-hidden="true">▾</span>
                </button>
            )}
        </section>
    );
}