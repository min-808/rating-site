'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { toNormalWidth, type Song } from '../lib/leaderboard';
import { compareSongs, new15, old35, rankFor, rateSong, RANK_CUTOFFS } from '../lib/song-calc';
import { songMatcher } from '../lib/song-search';
import { bestFiftyCss } from './best-fifty-css';
import Link from 'next/link';
import FallbackImage from './FallbackImage';
import FavoriteHeart from './FavoriteHeart';
import { favoriteHeartCss } from './favorite-heart-css';
import { titleSlug, displayTitle } from '../lib/song-id';
import { StatsBadge } from './StatsBadge';
import { NEW_POOL_VERSIONS, NEWEST_OLD_POOL_VERSION } from '../lib/versions';

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

// "a and b", "a, b and c"
const listOf = (names: string[]) =>
    names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

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

// the styles live in best-fifty-css.ts; re-exported so the favorite scores row can still
// import them from here
export { bestFiftyCss };

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

// DX score stars, from how much of the chart's DX score was reached
const DX_STAR_STEPS = [97, 95, 93, 90, 85];
function dxStars(pct: number) {
    const i = DX_STAR_STEPS.findIndex((min) => pct >= min);
    return i === -1 ? 0 : 5 - i;
}

// ranks worth showing in the "rating by rank" table
const TABLE_RANKS = ['S', 'S+', 'SS', 'SS+', 'SSS', 'SSS+'];

// what this chart would rate at the start of each rank, with no AP
function ratingByRank(song: Song) {
    return RANK_CUTOFFS
        .filter((c) => !c.edge && TABLE_RANKS.includes(c.rank))
        .map((c) => ({ rank: c.rank, at: c.min, rating: rateSong({ ...song, achievement: c.min, ap: false }) }));
    // RANK_CUTOFFS is already highest first, so the table reads SSS+ down to S
}

// every place a chart can be looked up. add more here (mai-notes, niconico...) and they
// show up in the popup: { label, sub, icon ('play' or 'search'), href }
function externalLinks(song: Song, diffLabel: string) {
    const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const isDx = /dx/i.test(song.kind ?? '');
    // mai-notes has no link we can build from a title, so this is a web search limited to
    // that site: it finds the song's page without saving a link for every song
    const maiNotes = `https://www.google.com/search?q=${encodeURIComponent(`site:mai-notes.com ${song.title}`)}`;
    return [
        { label: 'Chart gameplay', sub: 'YouTube', icon: 'play', href: yt(`${song.title} maimai${isDx ? ' DX' : ''} ${diffLabel}`.trim()) },
        { label: 'Song / MV', sub: 'YouTube', icon: 'play', href: yt(`${song.title} ${song.artist ?? ''}`.trim()) },
        { label: 'Chart viewer', sub: 'mai-notes', icon: 'search', href: maiNotes },
    ];
}

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
                {song.source === 'jp' ? (
                    <span className="bf-version-band bf-version-split" title="score from the japanese version">
                        <span className="bf-jp-part">JP</span>
                        {song.version && (
                            <span className="bf-version-name" style={{ background: versionColor(song.version) }}>{song.version}</span>
                        )}
                    </span>
                ) : song.version && (
                    <span className="bf-version-band" style={{ background: versionColor(song.version) }}>{song.version}</span>
                )}
            </button>
            {children}
        </li>
    );
}

// passes a click handler down, and reports which card was opened
function Section({ title, note, songs, extras, floor, gains, onOpen, keep }: {
    title: string; note: string; songs: Song[]; extras: Song[]; floor: number | null;
    gains: Map<string, number>;
    onOpen: (s: Selected) => void;
    keep: (s: Song) => boolean; // the search filter
}) {
    const [showExtras, setShowExtras] = useState(false);

    // filtered, but each chart keeps its real place in the list (#7 stays #7)
    const shown = songs.map((song, i) => ({ song, pos: i + 1 })).filter(({ song }) => keep(song));
    const shownExtras = extras.map((song, i) => ({ song, pos: i + 1 })).filter(({ song }) => keep(song));

    return (
        <section>
            <div className="bf-section">
                <h2>{title}</h2>
                <span>{note}</span>
                <StatsBadge title={title} songs={songs} />
            </div>
            {songs.length === 0 ? (
                <p className="bf-empty">no rated songs here yet</p>
            ) : shown.length === 0 ? (
                <p className="bf-empty">no charts in {title} match your search</p>
            ) : (
                <ul className="bf-grid">
                    {shown.map(({ song, pos }) => (
                        <SongCard
                            key={chartKey(song)}
                            song={song}
                            position={pos}
                            gain={gains.get(chartKey(song))}
                            onOpen={() => onOpen({ song, position: pos, list: title, size: songs.length })}
                        />
                    ))}
                </ul>
            )}

            {shownExtras.length > 0 && (
                <>
                    <button
                        type="button"
                        className="bf-extra-toggle"
                        aria-expanded={showExtras}
                        onClick={() => setShowExtras((v) => !v)}
                    >
                        {showExtras ? 'hide' : 'show'} {shownExtras.length} more chart{shownExtras.length === 1 ? '' : 's'} tied at the floor ({floor})
                        <span className={`bf-extra-chev${showExtras ? ' open' : ''}`} aria-hidden="true">▾</span>
                    </button>

                    {showExtras && (
                        <>
                            <p className="bf-extra-note">
                                these scores tie your {title} floor but don't count toward your rating
                            </p>
                            <ul className="bf-grid">
                                {shownExtras.map(({ song, pos }) => (
                                    <SongCard
                                        key={chartKey(song)}
                                        song={song}
                                        position={pos}
                                        muted
                                        gain={gains.get(chartKey(song))}
                                        onOpen={() => onOpen({
                                            song,
                                            position: pos,
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
    // a chart they haven't played (the level summary shows those too): its details, no score
    const isPlayed = song != null && song.achievement != null;
    const diff = song ? diffOf(song.difficulty) : null;
    const cutoff = isPlayed ? rankFor(song.achievement) : null;
    const [whole, decimals] = isPlayed ? song.achievement.toFixed(4).split('.') : ['', ''];
    const combo = song ? comboInfo(song) : null;
    const sync = song ? syncInfo(song) : null;
    const art = song?.jacket_blob || song?.jacket;
    const hasDxScore = song && song.dx_score != null && song.dx_max != null && song.dx_max > 0;
    const dxPct = hasDxScore ? ((song!.dx_score! / song!.dx_max!) * 100).toFixed(2) : null;
    const next = isPlayed ? nextRankInfo(song) : null;
    const hasAp = combo?.tier === 'ap' || combo?.tier === 'applus' || Boolean(song?.ap);
    const improvement = song ? improvementInfo(song) : null;
    const gain = song ? gains.get(chartKey(song)) ?? 0 : 0;
    const stars = dxPct != null ? dxStars(Number(dxPct)) : 0;
    const links = song && diff ? externalLinks(song, diff.label) : [];
    const rankRows = isPlayed && song.internal_difficulty != null ? ratingByRank(song) : [];
    const hasPrev = isPlayed && song.prev_achievement != null;
    // one small line under the artist: genre and BPM, whichever the song has
    const genreBpm = song ? [song.genre, song.bpm ? `${song.bpm} BPM` : null].filter(Boolean).join(' · ') : '';
    // the song's own page (/songs/<id>), for the title link and the heart
    // song_page when the server gave one (a title two songs share, lib/song-catalog.ts withSongPages)
    const songPageId = song ? song.song_page ?? titleSlug(song.title) : '';

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
                    <style>{favoriteHeartCss}</style>
                    {/* top right: favorite the song, then close */}
                    <FavoriteHeart id={songPageId} className="bf-dlg-heart" />
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
                            <h3 className="bf-dlg-title">
                                {/* the title opens the song's page: every chart and who has the top score */}
                                <Link href={`/songs/${encodeURIComponent(songPageId)}`} className="bf-dlg-title-link" title="open the song's page">
                                    {displayTitle(song.title)}
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                                </Link>
                            </h3>
                            {song.artist && <p className="bf-dlg-artist">{song.artist}</p>}
                            {genreBpm && <p className="bf-dlg-subline">{genreBpm}</p>}
                        </div>
                    </div>

                    <div className="bf-divider" />

                    {isPlayed ? (
                        <>
                            <div className="bf-score">
                                <RankBadge rank={cutoff?.rank} className="bf-dlg-rank-img" />
                                <span className="bf-big">{whole}.<small>{decimals}%</small></span>
                                <Badges song={song} className="bf-dlg-badges" />
                            </div>
                            {hasDxScore && (
                                <p className="bf-dxscore">
                                    {song.dx_score!.toLocaleString()} / {song.dx_max!.toLocaleString()} ({dxPct}%)
                                    {stars > 0 && <span className="bf-stars" title={`${stars} DX star${stars === 1 ? '' : 's'}`}>{'★'.repeat(stars)}</span>}
                                </p>
                            )}
                            <p className="bf-dlg-meta"><b>{song.rating} rating</b></p>
                            {hasPrev && <p className="bf-prev">previous best: {song.prev_achievement!.toFixed(4)}%</p>}
                        </>
                    ) : (
                        <p className="bf-dlg-unplayed">unplayed</p>
                    )}
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

                    {!isPlayed ? null : next ? (
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
                                <span className="bf-next-max">max rank reached, no more rating to gain from this chart</span>
                            </div>
                        ) : (
                            <div className="bf-next" title="an AP or AP+ adds a 1 rating bonus to this chart. since it's in your best 50, it adds straight to your total">
                                <span className="bf-next-label">next</span>
                                <span className="bf-next-need">AP or AP+</span>
                                <span className="bf-next-rating">→ {song.rating + 1} rating</span>
                                <span className="bf-next-gain">+1</span>
                            </div>
                        )
                    )}

                    {rankRows.length > 0 && (
                        <>
                            <div className="bf-divider" />
                            <p className="bf-section-label">Rating by rank</p>
                            <table className="bf-ranktable">
                                <thead><tr><th>Rank</th><th>Needs</th><th>Rating</th><th>vs. yours</th></tr></thead>
                                <tbody>
                                {rankRows.map((row) => {
                                    const reached = song.achievement >= row.at;
                                    const delta = row.rating - song.rating;
                                    return (
                                        <tr key={row.rank} className={`${reached ? 'is-reached' : ''}${cutoff?.rank === row.rank ? ' is-current' : ''}`}>
                                            <td><RankBadge rank={row.rank} className="bf-next-rank-img" /></td>
                                            <td>{row.at.toFixed(4)}%</td>
                                            <td>{row.rating}</td>
                                            <td>
                                                {cutoff?.rank === row.rank ? <span className="bf-rt-note">current</span>
                                                    : delta > 0 ? <span className="bf-rt-gain">+{delta}</span>
                                                        : <span className="bf-rt-note">{delta < 0 ? delta : '-'}</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                            <p className="bf-dlg-meta" style={{ marginTop: '0.4rem' }}>an AP or AP+ adds +1 on top of any rank</p>
                        </>
                    )}

                    {links.length > 0 && (
                        <>
                            <div className="bf-divider" />
                            <p className="bf-section-label">Watch &amp; look up</p>
                            <div className="bf-links">
                                {links.map((l) => (
                                    <a key={l.label} className="bf-link" href={l.href} target="_blank" rel="noopener noreferrer">
                                        {l.icon === 'search' ? (
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" /></svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                                        )}
                                        <span>{l.label}<small>{l.sub}</small></span>
                                    </a>
                                ))}
                            </div>
                        </>
                    )}
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
        .filter((s) => Math.floor(s.rating) === floor)
        .sort(compareSongs);

    return { floor, extras };
}

// extraNewVersions: versions only her japanese scores have (MAGICAL), named first in the
// B15 heading when her profile includes them (lib/jp-scores.ts)
export default function BestFifty({ data, extraNewVersions = [] }: { data?: Song[] | null; extraNewVersions?: string[] }) {
    const [selected, setSelected] = useState<Selected | null>(null);
    const [query, setQuery] = useState('');
    const songs = data ?? [];
    const b15 = new15(songs);
    const b35 = old35(songs);

    const b15Ties = tiedAtFloor(songs, b15, (s) => Boolean(s.new_pool));
    const b35Ties = tiedAtFloor(songs, b35, (s) => !s.new_pool);
    const gains = ratingGains(songs);

    // the search box: title or romaji (songMatcher, the same search the favorites picker uses),
    // or the artist. it only hides cards, so every chart keeps its place and the stats don't move
    const trimmed = query.trim();
    const keep = useMemo(() => {
        if (!trimmed) return () => true;
        const match = songMatcher(trimmed);
        const q = toNormalWidth(trimmed).normalize('NFKC').toLowerCase();
        return (s: Song) =>
            match(s.title, s.title_romaji) > 0 ||
            toNormalWidth(s.artist ?? '').normalize('NFKC').toLowerCase().includes(q);
    }, [trimmed]);
    const matchCount = trimmed ? [...b15, ...b35].filter(keep).length : 0;

    return (
        <div className="bf-wrap">
            <style>{bestFiftyCss}</style>

            <div className="bf-search">
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="search these songs"
                    aria-label="search best 50 songs"
                />
                {trimmed && <span className="bf-search-count">{matchCount} of {b15.length + b35.length} charts</span>}
            </div>

            <Section title="B15" note={`new songs (${listOf([...extraNewVersions, ...NEW_POOL_VERSIONS])})`} songs={b15}
                     extras={b15Ties.extras} floor={b15Ties.floor} gains={gains} onOpen={setSelected} keep={keep} />

            <hr className="divider" />

            <Section title="B35" note={`old songs (${NEWEST_OLD_POOL_VERSION} and below)`} songs={b35}
                     extras={b35Ties.extras} floor={b35Ties.floor} gains={gains} onOpen={setSelected} keep={keep} />

            <SongDetail entry={selected} gains={gains} onClose={() => setSelected(null)} />
        </div>
    );
}