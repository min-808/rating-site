'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import {
  filterAndSortSongs, filterChoices, songCardChartRows, DEFAULT_FILTERS, DIFFICULTY_ORDER, DIFFICULTY_LABELS,
  DIFFICULTY_COLORS, LEVEL_OPTIONS, type BrowserSong, type BrowseFilters, type MyCharts,
} from '../lib/song-browse';
import FallbackImage from './FallbackImage';
import FavoriteHeart from './FavoriteHeart';
import { loadFavoriteSongs, useFavoriteSongs } from './favorite-songs-store';
import { favoriteHeartCss } from './favorite-heart-css';
import { songPagesCss } from './song-pages-css';
import { displayTitle } from '../lib/song-id';

/**
 * /charts: every song, searchable. Everything filters in the browser as you type (the list
 * is sent once), using lib/song-browse.ts. Search finds a title (also its romaji, so
 * "umiyuri" finds a japanese title) or an artist. Shows 60 at a time; the search and the
 * drop-downs are kept in the address (?q=...&sort=...), so a search can be shared and going
 * back to the list brings them back (read once the page is open). Each card opens the song's page.
 */

/** How many song cards show at first, and how many more each "show more" adds. */
const SONGS_PER_PAGE = 50;

// each filter's name in the address. only filters that aren't at their default are written
const ADDRESS_NAMES: Record<keyof BrowseFilters, string> = {
  query: 'q', level: 'level', difficulty: 'diff', kind: 'type', genre: 'genre', version: 'version', region: 'region',
  pool: 'pool', hearted: 'hearted', played: 'played', raise: 'raise', sort: 'sort',
};
// what each drop-down can be (anything else in the address is ignored). the search box and
// genre / version take any text: one that matches nothing just shows no songs
const ALLOWED: Partial<Record<keyof BrowseFilters, readonly string[]>> = {
  level: LEVEL_OPTIONS, difficulty: DIFFICULTY_ORDER, kind: ['dx', 'standard'], region: ['na', 'intl'],
  pool: ['new', 'old'], hearted: ['1'], played: ['played', 'unplayed'], raise: ['rec'], sort: ['title', 'artist', 'popular', 'newest', 'oldest', 'level', 'easiest'],
};
const filterKeys = Object.keys(ADDRESS_NAMES) as (keyof BrowseFilters)[];

// the sort bar. orders: what the first tap sorts by, then what tapping it again flips to
const SORTS: { label: string; orders: BrowseFilters['sort'][]; arrows: string[] }[] = [
  { label: 'title', orders: ['title'], arrows: [] },
  { label: 'artist', orders: ['artist'], arrows: [] },
  { label: 'popularity', orders: ['popular'], arrows: [] },
  { label: 'version', orders: ['newest', 'oldest'], arrows: ['newest ↓', 'oldest ↑'] },
  { label: 'level', orders: ['level', 'easiest'], arrows: ['hardest ↓', 'easiest ↑'] },
];

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sg-row" role="group" aria-label={label}>
      <span className="sg-row-label">{label}</span>
      <div className="sg-chips">{children}</div>
    </div>
  );
}

/** One option in a filter row. color: a difficulty's color, a dot before it, and its fill when picked. */
function Chip({ on, color, onClick, title, disabled, children }: { on: boolean; color?: string; onClick: () => void; title?: string; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={title} disabled={disabled} className={`sg-chip${on ? ' is-on' : ''}${color ? ' has-color' : ''}`} aria-pressed={on} onClick={onClick}
      style={color ? ({ '--chip': color } as CSSProperties) : undefined}>
      {children}
    </button>
  );
}

function filtersFromAddress(params: URLSearchParams): BrowseFilters {
  const filters = { ...DEFAULT_FILTERS } as Record<keyof BrowseFilters, string>;
  for (const key of filterKeys) {
    const value = params.get(ADDRESS_NAMES[key]);
    if (value && (!ALLOWED[key] || ALLOWED[key].includes(value))) filters[key] = value;
  }
  return filters as BrowseFilters;
}

export default function SongBrowser({ songs, jacketBase = '', updated }: { songs: BrowserSong[]; jacketBase?: string; updated?: ReactNode }) {
  // the search box and every drop-down, and how many cards are showing
  const [filters, setFilters] = useState<BrowseFilters>(DEFAULT_FILTERS);
  const [visibleSongCount, setVisibleSongCount] = useState(SONGS_PER_PAGE);

  /** Change one filter (or the search text). A new search starts back at the top. */
  const setFilter = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setVisibleSongCount(SONGS_PER_PAGE);
  };

  const { genres, versions } = useMemo(() => filterChoices(songs), [songs]); // drop-down choices
  // hearted songs, for the "favorites" filter
  const favorites = useFavoriteSongs();
  useEffect(() => { loadFavoriteSongs(); }, []);
  // the signed-in player's charts, for "played / unplayed" and "recommended"
  // (/api/profile/my-charts). mineLoaded: the answer is in (null mine then: signed out, or no scores)
  const [mine, setMine] = useState<(MyCharts & { floors: { new: number; old: number } }) | null>(null);
  const [mineLoaded, setMineLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile/my-charts')
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.hasScores) setMine({ played: d.played, recommended: d.recommended ?? {}, floors: d.floors }); })
      .catch(() => {}) // greyed out then: the list works the same without them
      .finally(() => { if (!cancelled) setMineLoaded(true); });
    return () => { cancelled = true; };
  }, []);
  // greyed out once we know there's nothing to filter by, with why
  const noScores = mineLoaded && !mine;
  const noRecommended = mineLoaded && (!mine || Object.keys(mine.recommended).length === 0);
  // the whole list's counts for the region picked, for the line under the title
  const regionCounts = useMemo(() => {
    const inRegion = filters.region === 'na' ? songs.filter((song) => song.na) : songs;
    return { songs: inRegion.length, charts: inRegion.reduce((n, song) => n + song.charts.length, 0) };
  }, [songs, filters.region]);
  const matchingSongs = useMemo(() => filterAndSortSongs(songs, filters, favorites.ids, mine), [songs, filters, favorites.ids, mine]);
  // anything different from the defaults? then show "reset filters"
  const filtersChanged = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  // how many filters are picked (not the search or the sort), for the phone's "filters (2)" button
  const pickedCount = filterKeys.filter((key) => key !== 'query' && key !== 'sort' && filters[key] !== DEFAULT_FILTERS[key]).length;
  const [filtersOpen, setFiltersOpen] = useState(false);

  // "new songs" lists the newest first, like sorting by version. only while the sort is
  // still the default (title), so a sort someone picked stays, and turning it off goes back
  const toggleNewSongs = () => {
    const turningOn = filters.pool !== 'new';
    setFilters((previous) => ({
      ...previous,
      pool: turningOn ? 'new' : '',
      sort: turningOn && previous.sort === 'title' ? 'newest' : !turningOn && previous.sort === 'newest' ? 'title' : previous.sort,
    }));
    setVisibleSongCount(SONGS_PER_PAGE);
  };

  // the version row shows the maimai DX versions; the ones before DX (FiNALE and older) are
  // behind "older versions", unless one of them is picked
  const [showOlderVersions, setShowOlderVersions] = useState(false);
  const firstOlderIndex = versions.indexOf('DX') + 1; // versions are newest first. 0: no "DX", so show them all
  const olderPicked = firstOlderIndex > 0 && versions.indexOf(filters.version) >= firstOlderIndex;
  const versionsShown = showOlderVersions || olderPicked || firstOlderIndex === 0 ? versions : versions.slice(0, firstOlderIndex);

  // a shared link, or coming back to the list, fills the search and drop-downs from the
  // address. read here, in the browser, so the page itself doesn't depend on the request
  // and can be kept and served to everyone
  const [addressRead, setAddressRead] = useState(false);
  useEffect(() => {
    setFilters(filtersFromAddress(new URLSearchParams(window.location.search)));
    setAddressRead(true);
  }, []);

  // keep them in the address, without adding a history entry for every keystroke or pick
  useEffect(() => {
    if (!addressRead) return; // not before the address has been read, or it would erase it
    const url = new URL(window.location.href);
    for (const key of filterKeys) {
      const value = key === 'query' ? filters.query.trim() : filters[key];
      if (value && value !== DEFAULT_FILTERS[key]) url.searchParams.set(ADDRESS_NAMES[key], value);
      else url.searchParams.delete(ADDRESS_NAMES[key]);
    }
    window.history.replaceState(window.history.state, '', url);
  }, [filters, addressRead]);

  return (
    <>
      <style>{songPagesCss}</style>
      <style>{favoriteHeartCss}</style>

      {/* the counts follow the region picked below; updated is the page's last-updated lines */}
      <p className="sg-updated">
        There are currently <b>{regionCounts.songs.toLocaleString('en-US')}</b> songs{' '}
        (<b>{regionCounts.charts.toLocaleString('en-US')}</b> charts)
        {updated && <><br /><br />{updated}</>}
      </p>

      <div className="sg-panel">
        <label className="sg-searchbox">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="sg-input"
            type="search"
            value={filters.query}
            onChange={(event) => setFilter('query', event.target.value)}
            placeholder="search charts"
            aria-label="search charts"
          />
        </label>

        {/* phones only: the rows are tall, so they fold away behind this */}
        <button type="button" className="sg-filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
          {filtersOpen ? 'hide filters' : `filters${pickedCount ? ` (${pickedCount})` : ''}`}
        </button>

        {/* one row per filter, osu!-style: tap an option to pick it */}
        <div className={`sg-rows${filtersOpen ? ' is-open' : ''}`}>
          <FilterRow label="general">
            <Chip on={filters.pool === 'new'} onClick={toggleNewSongs}>new songs</Chip>
            <Chip on={filters.pool === 'old'} onClick={() => setFilter('pool', filters.pool === 'old' ? '' : 'old')}>old songs</Chip>
            {/* there from the start, like the rest (the page is the same for everyone, so who's
                signed in is only known once the browser asks); greyed out once we know they aren't */}
            <Chip
              on={filters.hearted === '1'}
              onClick={() => setFilter('hearted', filters.hearted ? '' : '1')}
              disabled={favorites.loaded && !favorites.signedIn}
              title={favorites.loaded && !favorites.signedIn ? 'sign in to favorite songs' : undefined}
            >
              favorites
            </Chip>
          </FilterRow>
          {/* there from the start, like the rest (the page is the same for everyone, so whose
              scores they are is only known once the browser asks); greyed out when there are none */}
          <FilterRow label="my scores">
            <Chip on={!filters.played} onClick={() => setFilter('played', '')} disabled={noScores}>any</Chip>
            <Chip on={filters.played === 'played'} onClick={() => setFilter('played', 'played')} disabled={noScores}
              title={noScores ? 'sign in to filter by your scores' : undefined}>played</Chip>
            <Chip on={filters.played === 'unplayed'} onClick={() => setFilter('played', 'unplayed')} disabled={noScores}
              title={noScores ? 'sign in to filter by your scores' : undefined}>unplayed</Chip>
            <Chip
              on={filters.raise === 'rec'}
              onClick={() => setFilter('raise', filters.raise === 'rec' ? '' : 'rec')}
              disabled={noRecommended}
              title={noScores ? 'sign in to see charts recommended for you'
                : noRecommended ? 'recommendations start at 13000 rating'
                : 'charts that would raise your rating, that players at your rating SSS+ most often (stats from maishift)'}
            >
              recommended
            </Chip>
          </FilterRow>
          <FilterRow label="difficulty">
            <Chip on={!filters.difficulty} onClick={() => setFilter('difficulty', '')}>any</Chip>
            {DIFFICULTY_ORDER.map((d) => (
              <Chip key={d} on={filters.difficulty === d} color={DIFFICULTY_COLORS[d]} onClick={() => setFilter('difficulty', d)}>
                {DIFFICULTY_LABELS[d].toLowerCase()}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="level">
            <Chip on={!filters.level} onClick={() => setFilter('level', '')}>any</Chip>
            {LEVEL_OPTIONS.map((l) => <Chip key={l} on={filters.level === l} onClick={() => setFilter('level', l)}>{l}</Chip>)}
          </FilterRow>
          <FilterRow label="chart type">
            <Chip on={!filters.kind} onClick={() => setFilter('kind', '')}>any</Chip>
            <Chip on={filters.kind === 'dx'} onClick={() => setFilter('kind', 'dx')}>DX</Chip>
            <Chip on={filters.kind === 'standard'} onClick={() => setFilter('kind', 'standard')}>standard</Chip>
          </FilterRow>
          <FilterRow label="genre">
            <Chip on={!filters.genre} onClick={() => setFilter('genre', '')}>any</Chip>
            {genres.map((g) => <Chip key={g} on={filters.genre === g} onClick={() => setFilter('genre', g)}>{g}</Chip>)}
          </FilterRow>
          <FilterRow label="version">
            <Chip on={!filters.version} onClick={() => setFilter('version', '')}>any</Chip>
            {versionsShown.map((v) => <Chip key={v} on={filters.version === v} onClick={() => setFilter('version', v)}>{v}</Chip>)}
            {firstOlderIndex > 0 && !olderPicked && (
              <button type="button" className="sg-chip-more" aria-expanded={showOlderVersions} onClick={() => setShowOlderVersions((shown) => !shown)}>
                {showOlderVersions ? 'fewer versions' : `older versions (${versions.length - firstOlderIndex})`}
              </button>
            )}
          </FilterRow>
          <FilterRow label="region">
            <Chip on={filters.region === 'na'} onClick={() => setFilter('region', 'na')}>na</Chip>
            <Chip on={filters.region === 'intl'} onClick={() => setFilter('region', 'intl')}>international</Chip>
          </FilterRow>
        </div>

        {/* sort: tap one to sort by it, tap it again to flip the order (where there are two) */}
        <div className="sg-sortbar" role="group" aria-label="sort by">
          <span className="sg-row-label">sort by</span>
          {SORTS.map((sort) => {
            const index = sort.orders.indexOf(filters.sort);
            const on = index >= 0;
            const next = on && sort.orders.length > 1 ? sort.orders[1 - index] : sort.orders[0];
            return (
              <button key={sort.label} type="button" className={`sg-sort${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setFilter('sort', next)}>
                {sort.label}
                {on && sort.orders.length > 1 && <span className="sg-sort-dir">{sort.arrows[index]}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {filtersChanged && (
        <div className="sg-bar">
          <button type="button" className="sg-reset" onClick={() => { setFilters(DEFAULT_FILTERS); setVisibleSongCount(SONGS_PER_PAGE); }}>reset filters</button>
        </div>
      )}

      {matchingSongs.length === 0 ? (
        <p className="sg-empty">no songs match</p>
      ) : (
        <ul className="sg-grid">
          {matchingSongs.slice(0, visibleSongCount).map((song) => (
            <li key={song.id} className="sg-item">
              <Link href={`/charts/${encodeURIComponent(song.id)}`} className="sg-link">
                {/* the jacket again, very faded, behind the whole card. same address as the small one, so it is downloaded once */}
                {song.jacket && <FallbackImage src={jacketBase + song.jacket} alt="" className="sg-bg" />}
                <div className="sg-jacket">
                  {song.jacket ? <FallbackImage src={jacketBase + song.jacket} alt="" /> : <span aria-hidden="true">♪</span>}
                </div>
                <div className="sg-info">
                  <p className="sg-name">{displayTitle(song.title)}</p>
                  {song.artist && <p className="sg-artist">{song.artist}</p>}
                  <div className="sg-pills">
                    {songCardChartRows(song, filters, mine).map((row) => (
                      <div className="sg-pillrow" key={row.isDx ? 'dx' : 'standard'}>
                        <span className="sg-kind">{row.isDx ? 'DX' : 'ST'}</span>
                        {row.pills.map((pill) => (
                          <span key={pill.key} className={`sg-pill${pill.highlightClass}`} style={{ background: pill.color }} title={pill.tooltip}>{pill.label}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
              <FavoriteHeart id={song.id} className="sg-heart" />
            </li>
          ))}
        </ul>
      )}

      {matchingSongs.length > visibleSongCount && (
        <button type="button" className="sg-more" onClick={() => setVisibleSongCount((count) => count + SONGS_PER_PAGE)}>
          show more ({(matchingSongs.length - visibleSongCount).toLocaleString()} left)
        </button>
      )}
    </>
  );
}
