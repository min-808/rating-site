'use client';

import { useState } from 'react';
import Link from 'next/link';
import FallbackImage from './FallbackImage';
import { favoriteSongsCss } from './favorite-songs-css';
import { setSongFavorite } from './favorite-songs-store';
import { displayTitle } from '../lib/song-id';

/**
 * A profile's "favorite songs": the songs the player hearted on the song pages, newest
 * first, each a small card (jacket, title, artist) linking to that song's page. The first
 * 12 show, and the rest are behind a <details> button. On their own profile, each card
 * has an × that un-hearts it right there (favorite-songs-store.ts, same as the hearts).
 * Nobody but the player sees an empty section, and the player sees how to fill it.
 */

export type FavoriteSongItem = { id: string; title: string; artist: string | null; jacket: string | null };

const SHOWN = 12;

function Card({ song, onRemove }: { song: FavoriteSongItem; onRemove?: (song: FavoriteSongItem) => void }) {
  return (
    <li className="fs-li">
      <Link href={`/charts/${encodeURIComponent(song.id)}`} className="fs-item">
        {song.jacket && <FallbackImage src={song.jacket} alt="" className="fs-bg" />}
        <span className="fs-jacket">{song.jacket && <FallbackImage src={song.jacket} alt="" />}</span>
        <span className="fs-text">
          <p className="fs-title">{displayTitle(song.title)}</p>
          {song.artist && <p className="fs-artist">{song.artist}</p>}
        </span>
      </Link>
      {onRemove && (
        <button type="button" className="fs-remove" onClick={() => onRemove(song)}
          aria-label={`Remove ${displayTitle(song.title)} from favorites`} title="remove from favorites">
          ×
        </button>
      )}
    </li>
  );
}

export default function FavoriteSongs({ songs, isOwner }: { songs: FavoriteSongItem[]; isOwner: boolean }) {
  // removed on this visit; the server has (or is being) told
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const shown = songs.filter((s) => !removed.has(s.id));
  if (shown.length === 0 && !isOwner) return null;
  const rest = shown.slice(SHOWN);

  // gone right away; back again if the server says no
  const remove = async (song: FavoriteSongItem) => {
    setError(null);
    setRemoved((prev) => new Set(prev).add(song.id));
    const failed = await setSongFavorite(song.id, false);
    if (failed) {
      setRemoved((prev) => { const next = new Set(prev); next.delete(song.id); return next; });
      setError(failed);
    }
  };
  const onRemove = isOwner ? remove : undefined;

  return (
    <section className="fs-card" aria-label="favorite songs">
      <style>{favoriteSongsCss}</style>
      <div className="fs-head">
        <h2>favorite songs</h2>
      </div>
      {error && <p className="fs-error" role="alert">{error}</p>}

      {shown.length === 0 ? (
        <p className="fs-empty">
          nothing here yet. tap the heart on a song in <Link href="/charts">the song list</Link> to add it.
        </p>
      ) : (
        <>
          <ul className="fs-grid">{shown.slice(0, SHOWN).map((s) => <Card key={s.id} song={s} onRemove={onRemove} />)}</ul>
          {rest.length > 0 && (
            <details className="fs-more">
              <summary>show {rest.length} more</summary>
              <ul className="fs-grid">{rest.map((s) => <Card key={s.id} song={s} onRemove={onRemove} />)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
