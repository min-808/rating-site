import Link from 'next/link';
import FallbackImage from './FallbackImage';
import { favoriteSongsCss } from './favorite-songs-css';
import { displayTitle } from '../lib/song-id';

/**
 * A profile's "favorite songs": the songs the player hearted on the song pages, newest
 * first, each a small card (jacket, title, artist) linking to that song's page. A server
 * component, no scripts: the first 12 show, and the rest are behind a <details> button.
 * Nobody but the player sees an empty section, and the player sees how to fill it.
 */

export type FavoriteSongItem = { id: string; title: string; artist: string | null; jacket: string | null };

const SHOWN = 12;

function Card({ song }: { song: FavoriteSongItem }) {
  return (
    <li>
      <Link href={`/charts/${encodeURIComponent(song.id)}`} className="fs-item">
        {song.jacket && <FallbackImage src={song.jacket} alt="" className="fs-bg" />}
        <span className="fs-jacket">{song.jacket && <FallbackImage src={song.jacket} alt="" />}</span>
        <span className="fs-text">
          <p className="fs-title">{displayTitle(song.title)}</p>
          {song.artist && <p className="fs-artist">{song.artist}</p>}
        </span>
      </Link>
    </li>
  );
}

export default function FavoriteSongs({ songs, isOwner }: { songs: FavoriteSongItem[]; isOwner: boolean }) {
  if (songs.length === 0 && !isOwner) return null;
  const rest = songs.slice(SHOWN);

  return (
    <section className="fs-card" aria-label="favorite songs">
      <style>{favoriteSongsCss}</style>
      <div className="fs-head">
        <h2>favorite songs</h2>
        {songs.length > 0 && <span className="fs-count">{songs.length}</span>}
      </div>

      {songs.length === 0 ? (
        <p className="fs-empty">
          nothing here yet. tap the heart on a song in <Link href="/charts">the song list</Link> to add it.
        </p>
      ) : (
        <>
          <ul className="fs-grid">{songs.slice(0, SHOWN).map((s) => <Card key={s.id} song={s} />)}</ul>
          {rest.length > 0 && (
            <details className="fs-more">
              <summary>show {rest.length} more</summary>
              <ul className="fs-grid">{rest.map((s) => <Card key={s.id} song={s} />)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
