'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { loadFavoriteSongs, setSongFavorite, useFavoriteSongs } from './favorite-songs-store';

/**
 * The heart that favorites a song, like osu!'s: an outline until it's hearted, then filled.
 * One on each card of /charts and one on a song's page. Not signed in: tapping explains
 * instead (the hearts are saved on the account). Whatever shows hearts draws
 * favoriteHeartCss once (favorite-heart-css.ts).
 */
export default function FavoriteHeart({ id, className = '' }: { id: string; className?: string }) {
  const { loaded, signedIn, ids } = useFavoriteSongs();
  const [tip, setTip] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { void loadFavoriteSongs(); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const on = ids.has(id);
  const say = (message: string) => {
    setTip(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTip(null), 2800);
  };

  const onClick = async (e: MouseEvent) => {
    e.preventDefault(); // it sits next to the card's link, never inside it, but be sure
    e.stopPropagation();
    if (loaded && !signedIn) return say('sign in to favorite songs');
    const error = await setSongFavorite(id, !on);
    if (error) say(error);
  };

  const label = on ? 'remove from favorite songs' : 'add to favorite songs';
  return (
    <button type="button" className={`fh${on ? ' is-on' : ''}${className ? ` ${className}` : ''}`} onClick={onClick} aria-pressed={on} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.8 4.8 6.3 4.8c2 0 3.6 1.1 4.5 2.6l1.2 1.9 1.2-1.9c.9-1.5 2.5-2.6 4.5-2.6 3.5 0 5.4 3.6 3.9 7C19.5 16.4 12 21 12 21z" /></svg>
      {tip && <span className="fh-tip" role="status">{tip}</span>}
    </button>
  );
}
