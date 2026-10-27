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

export function songId(title: string): string {
  const bytes = new TextEncoder().encode(songKey(title));
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The song key an id stands for, or null if it isn't a valid id. */
export function songKeyFromId(id: string): string | null {
  try {
    const base64 = decodeURIComponent(id).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
