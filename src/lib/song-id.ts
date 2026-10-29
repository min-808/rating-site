import { toNormalWidth } from './leaderboard';

/**
 * A song's address: /songs/<id>. The id is the song's title, folded the way the scrapers
 * match titles (full-width letters made normal, spaces squeezed, lower case), then turned
 * into url-safe base64. Titles hold slashes, symbols and japanese text, which don't travel
 * well in a url as they are; this always does. Works on the server and in the browser.
 */

/** The title as the scrapers match it: "ＬＩＮＫ  " and "link" are the same song. */
export const songKey = (title: string) =>
  toNormalWidth(String(title ?? '')).replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The address of the song whose title is blank (the game has one). Its folded title is "",
 * which would give an empty id and the address /songs/ (the song list), so it gets this
 * word instead. "untitled" can never be a real song's id: decoded as base64 it isn't valid
 * text, so no title folds to it.
 */
export const NO_TITLE_ID = 'untitled';

/** What to show for a song's title: the title, or "(no title)" when it's blank. */
export const displayTitle = (title: string | null | undefined) => (songKey(title ?? '') ? String(title) : '(no title)');

export function songId(title: string): string {
  const key = songKey(title);
  if (key === '') return NO_TITLE_ID;
  const bytes = new TextEncoder().encode(key);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The song key an id stands for, or null if it isn't a valid id. ("" is the blank-titled song.) */
export function songKeyFromId(id: string): string | null {
  if (id === NO_TITLE_ID) return '';
  try {
    const base64 = decodeURIComponent(id).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
