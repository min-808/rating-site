'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  filterAndSortSongs, filterChoices, songCardChartRows, DEFAULT_FILTERS, DIFFICULTY_ORDER, DIFFICULTY_LABELS,
  LEVEL_OPTIONS, type BrowserSong, type BrowseFilters,
} from '../lib/song-browse';
import FallbackImage from './FallbackImage';
import FavoriteHeart from './FavoriteHeart';
import { favoriteHeartCss } from './favorite-heart-css';
import { songPagesCss } from './song-pages-css';
import { displayTitle } from '../lib/song-id';

/**
 * /songs: every song, searchable. Everything filters in the browser as you type (the list
 * is sent once), using lib/song-browse.ts. Search finds a title (also its romaji, so
 * "umiyuri" finds a japanese title) or an artist. Shows 60 at a time; the search is kept in
 * the address (?q=) so a search can be shared (read once the page is open). Each card opens the song's page.
 */

/** How many song cards show at first, and how many more each "show more" adds. */
const SONGS_PER_PAGE = 60;

export default function SongBrowser({ songs, jacketBase = '' }: { songs: BrowserSong[]; jacketBase?: string }) {
  // the search box and every drop-down, and how many cards are showing
  const [filters, setFilters] = useState<BrowseFilters>(DEFAULT_FILTERS);
  const [visibleSongCount, setVisibleSongCount] = useState(SONGS_PER_PAGE);

  /** Change one filter (or the search text). A new search starts back at the top. */
  const setFilter = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setVisibleSongCount(SONGS_PER_PAGE);
  };

  const { genres, versions } = useMemo(() => filterChoices(songs), [songs]); // drop-down choices
  const matchingSongs = useMemo(() => filterAndSortSongs(songs, filters), [songs, filters]);
  // anything different from the defaults? then show "reset filters"
  const filtersChanged = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  // a shared link (/songs?q=...) fills the search box. read here, in the browser, so the
  // page itself doesn't depend on the request and can be kept and served to everyone
  const [addressRead, setAddressRead] = useState(false);
  useEffect(() => {
    const searchInAddress = new URLSearchParams(window.location.search).get('q');
    if (searchInAddress) setFilters((previous) => ({ ...previous, query: searchInAddress }));
    setAddressRead(true);
  }, []);

  // keep the search in the address, without adding a history entry for every keystroke
  useEffect(() => {
    if (!addressRead) return; // not before the address has been read, or it would erase it
    const url = new URL(window.location.href);
    const searchText = filters.query.trim();
    if (searchText) url.searchParams.set('q', searchText); else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
  }, [filters.query, addressRead]);

  return (
    <>
      <style>{songPagesCss}</style>
      <style>{favoriteHeartCss}</style>

      <div className="sg-controls">
        <input
          className="sg-input sg-search"
          type="search"
          value={filters.query}
          onChange={(event) => setFilter('query', event.target.value)}
          placeholder="search songs (title, romaji or artist)"
          aria-label="search songs"
        />
        <select className="sg-select" value={filters.level} onChange={(event) => setFilter('level', event.target.value)} aria-label="level">
          <option value="">any level</option>
          {[...LEVEL_OPTIONS].reverse().map((l) => <option key={l} value={l}>level {l}</option>)}
        </select>
        <select className="sg-select" value={filters.difficulty} onChange={(event) => setFilter('difficulty', event.target.value)} aria-label="difficulty">
          <option value="">any difficulty</option>
          {DIFFICULTY_ORDER.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
        </select>
        <select className="sg-select" value={filters.kind} onChange={(event) => setFilter('kind', event.target.value as BrowseFilters['kind'])} aria-label="chart type">
          <option value="">DX and standard</option>
          <option value="dx">DX only</option>
          <option value="standard">standard only</option>
        </select>
        <select className="sg-select" value={filters.genre} onChange={(event) => setFilter('genre', event.target.value)} aria-label="genre">
          <option value="">any genre</option>
          {genres.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="sg-select" value={filters.version} onChange={(event) => setFilter('version', event.target.value)} aria-label="version">
          <option value="">any version</option>
          {versions.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select className="sg-select" value={filters.region} onChange={(event) => setFilter('region', event.target.value as BrowseFilters['region'])} aria-label="region">
          <option value="na">North America</option>
          <option value="intl">every song (international)</option>
        </select>
        <select className="sg-select" value={filters.sort} onChange={(event) => setFilter('sort', event.target.value as BrowseFilters['sort'])} aria-label="sort by">
          <option value="title">sort: title</option>
          <option value="newest">sort: newest first</option>
          <option value="level">sort: hardest first</option>
        </select>
      </div>

      <div className="sg-bar">
        <span>{matchingSongs.length.toLocaleString()} song{matchingSongs.length === 1 ? '' : 's'}</span>
        {filtersChanged && <button type="button" className="sg-reset" onClick={() => { setFilters(DEFAULT_FILTERS); setVisibleSongCount(SONGS_PER_PAGE); }}>reset filters</button>}
      </div>

      {matchingSongs.length === 0 ? (
        <p className="sg-empty">no songs match</p>
      ) : (
        <ul className="sg-grid">
          {matchingSongs.slice(0, visibleSongCount).map((song) => (
            <li key={song.id} className="sg-item">
              <Link href={`/songs/${song.id}`} className="sg-link">
                {/* the jacket again, very faded, behind the whole card. same address as the small one, so it is downloaded once */}
                {song.jacket && <FallbackImage src={jacketBase + song.jacket} alt="" className="sg-bg" />}
                <div className="sg-jacket">
                  {song.jacket ? <FallbackImage src={jacketBase + song.jacket} alt="" /> : <span aria-hidden="true">♪</span>}
                </div>
                <div className="sg-info">
                  <p className="sg-name">{displayTitle(song.title)}</p>
                  {song.artist && <p className="sg-artist">{song.artist}</p>}
                  <div className="sg-pills">
                    {songCardChartRows(song, filters).map((row) => (
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
