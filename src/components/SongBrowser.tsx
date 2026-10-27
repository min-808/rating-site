'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  browse, facets, matchingCharts, DEFAULT_FILTERS, DIFFICULTY_ORDER, DIFFICULTY_LABELS, DIFFICULTY_COLORS,
  LEVEL_OPTIONS, constantLabel, type BrowserSong, type BrowseFilters,
} from '../lib/song-browse';
import FallbackImage from './FallbackImage';
import { songPagesCss } from './song-pages-css';

/**
 * /songs: every song, searchable. Everything filters in the browser as you type (the list
 * is sent once), using lib/song-browse.ts. Search finds a title (also its romaji, so
 * "umiyuri" finds a japanese title) or an artist. Shows 60 at a time; the search is kept in
 * the address (?q=) so a search can be shared. Each card opens the song's page.
 */

const PAGE_SIZE = 60;

// the pills on a card: the hardest charts, so you can see at a glance how tough it gets
function cardPills(song: BrowserSong, f: BrowseFilters) {
  const pool = matchingCharts(song, f);
  const top = pool.filter((c) => c[1] >= 3); // master and re:master
  const chosen = top.length ? top : [...pool].sort((a, b) => b[1] - a[1]).slice(0, 1);
  return chosen.map(([kind, difficulty, internal]) => ({
    key: `${kind}-${difficulty}`,
    label: `${kind ? 'DX' : 'STD'} ${constantLabel(internal)}`,
    color: DIFFICULTY_COLORS[DIFFICULTY_ORDER[difficulty]],
    title: `${kind ? 'DX' : 'Standard'} ${DIFFICULTY_LABELS[DIFFICULTY_ORDER[difficulty]]}`,
  }));
}

export default function SongBrowser({ songs, initialQuery = '' }: { songs: BrowserSong[]; initialQuery?: string }) {
  const [f, setF] = useState<BrowseFilters>({ ...DEFAULT_FILTERS, query: initialQuery });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const set = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) => {
    setF((prev) => ({ ...prev, [key]: value }));
    setLimit(PAGE_SIZE); // a new search starts at the top
  };

  const { genres, versions } = useMemo(() => facets(songs), [songs]);
  const results = useMemo(() => browse(songs, f), [songs, f]);
  const changed = JSON.stringify({ ...f, query: '' }) !== JSON.stringify({ ...DEFAULT_FILTERS, query: '' }) || f.query !== '';

  // keep the search in the address, without adding a history entry for every keystroke
  useEffect(() => {
    const url = new URL(window.location.href);
    if (f.query.trim()) url.searchParams.set('q', f.query.trim()); else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
  }, [f.query]);

  return (
    <>
      <style>{songPagesCss}</style>

      <div className="sg-controls">
        <input
          className="sg-input sg-search"
          type="search"
          value={f.query}
          onChange={(e) => set('query', e.target.value)}
          placeholder="search songs (title, romaji or artist)"
          aria-label="search songs"
        />
        <select className="sg-select" value={f.level} onChange={(e) => set('level', e.target.value)} aria-label="level">
          <option value="">any level</option>
          {[...LEVEL_OPTIONS].reverse().map((l) => <option key={l} value={l}>level {l}</option>)}
        </select>
        <select className="sg-select" value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)} aria-label="difficulty">
          <option value="">any difficulty</option>
          {DIFFICULTY_ORDER.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
        </select>
        <select className="sg-select" value={f.kind} onChange={(e) => set('kind', e.target.value as BrowseFilters['kind'])} aria-label="chart type">
          <option value="">DX and standard</option>
          <option value="dx">DX only</option>
          <option value="standard">standard only</option>
        </select>
        <select className="sg-select" value={f.genre} onChange={(e) => set('genre', e.target.value)} aria-label="genre">
          <option value="">any genre</option>
          {genres.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="sg-select" value={f.version} onChange={(e) => set('version', e.target.value)} aria-label="version">
          <option value="">any version</option>
          {versions.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select className="sg-select" value={f.region} onChange={(e) => set('region', e.target.value as BrowseFilters['region'])} aria-label="region">
          <option value="na">North America</option>
          <option value="intl">every song (international)</option>
        </select>
        <select className="sg-select" value={f.sort} onChange={(e) => set('sort', e.target.value as BrowseFilters['sort'])} aria-label="sort by">
          <option value="title">sort: title</option>
          <option value="newest">sort: newest first</option>
          <option value="level">sort: hardest first</option>
        </select>
      </div>

      <div className="sg-bar">
        <span>{results.length.toLocaleString()} song{results.length === 1 ? '' : 's'}</span>
        {changed && <button type="button" className="sg-reset" onClick={() => { setF(DEFAULT_FILTERS); setLimit(PAGE_SIZE); }}>reset filters</button>}
      </div>

      {results.length === 0 ? (
        <p className="sg-empty">no songs match</p>
      ) : (
        <ul className="sg-grid">
          {results.slice(0, limit).map((song) => (
            <li key={song.id}>
              <Link href={`/songs/${song.id}`} className="sg-link">
                <div className="sg-jacket">
                  {song.jacket ? <FallbackImage src={song.jacket} alt="" /> : <span aria-hidden="true">♪</span>}
                </div>
                <div className="sg-info">
                  <p className="sg-name">{song.title}</p>
                  {song.artist && <p className="sg-artist">{song.artist}</p>}
                  <div className="sg-pills">
                    {cardPills(song, f).map((p) => (
                      <span key={p.key} className="sg-pill" style={{ background: p.color }} title={p.title}>{p.label}</span>
                    ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {results.length > limit && (
        <button type="button" className="sg-more" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
          show more ({(results.length - limit).toLocaleString()} left)
        </button>
      )}
    </>
  );
}
