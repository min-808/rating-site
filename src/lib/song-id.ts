import { toNormalWidth } from './leaderboard';

/**
 * A song's address: /songs/<id>. The id is readable: the title, lower case, with its letters
 * and numbers (any script, so japanese stays japanese) and a "-" for everything else:
 * "PANDORA PARADOXXX" -> pandora-paradoxxx, "ガランド" -> ガランド. A title with no letters
 * or numbers (∀, +♂) is its own id, and the blank-titled song is "untitled".
 *
 * A few songs need more (lib/song-catalog.ts gives out the ids): two different songs with
 * the same title (the two "Link"s), or whose titles come out the same ("ECHO" and "ECHO,"),
 * get the artist added: link-clean-tears. Their plain address (/songs/link) goes to the
 * oldest of them, and so do old base64 addresses (songKeyFromLegacyId). Works on the server
 * and in the browser.
 */

/** The title as the scrapers match it: "ＬＩＮＫ  " and "link" are the same song. */
export const songKey = (title: string) =>
  toNormalWidth(String(title ?? '')).replace(/\s+/g, ' ').trim().toLowerCase();

/** The address of the song whose title is blank (the game has one), which would otherwise be /songs/ (the list). */
export const NO_TITLE_ID = 'untitled';

const slug = (text: string) =>
  songKey(text).normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

/** A song's address from its title alone: what most songs have (see above for the few that don't). */
export function titleSlug(title: string): string {
  return slug(title) || String(title ?? '').trim() || NO_TITLE_ID;
}

/**
 * The artist, short, for telling apart songs whose titles are the same: the part before a
 * "feat." or a bracket. "Clean Tears feat. Youna" -> clean-tears,
 * "Circle of friends(天月-あまつき-・…)" -> circle-of-friends.
 */
export function artistSlug(artist: string | null | undefined): string {
  const text = String(artist ?? '');
  return slug(text.split(/\s+(?:feat|ft)\.?\s|[(（「/／]/i)[0]) || slug(text);
}

/**
 * What to show for a song's title: the title as the game has it. The blank-titled song shows
 * as a blank, like in the game: a full-width space, which (unlike a normal space) the page
 * doesn't squeeze away, so the line keeps its height.
 */
export const displayTitle = (title: string | null | undefined) => (songKey(title ?? '') ? String(title) : '\u3000');

/** The title in words, for where a blank can't be seen: the browser tab, alt text, link previews. */
export const titleInWords = (title: string | null | undefined) => (songKey(title ?? '') ? String(title) : '(no title)');

/**
 * The song key an old address stood for, or null. Addresses used to be the folded title in
 * url-safe base64 (/songs/cGFuZG9yYSBwYXJhZG94eHg); those still work, sent on to the new one.
 */
export function songKeyFromLegacyId(id: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  try {
    const base64 = decodeURIComponent(id).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))); // fatal: not text, not an old address
  } catch {
    return null;
  }
}
