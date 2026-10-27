/**
 * Where to look a song up. Nothing is saved per song: each one is a search built from the
 * title, so every song has them. Plain module (the song pages are server components).
 *   icon: 'play' for videos, 'search' for a site search
 */
export type SongLink = { label: string; sub: string; icon: 'play' | 'search'; href: string };

export function songLinks(o: { title: string; artist?: string | null; kind?: string; difficultyLabel?: string }): SongLink[] {
  const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  const isDx = /dx/i.test(o.kind ?? '');
  return [
    { label: 'Chart gameplay', sub: 'YouTube', icon: 'play', href: yt(`${o.title} maimai${isDx ? ' DX' : ''} ${o.difficultyLabel ?? ''}`.trim()) },
    { label: 'Song / MV', sub: 'YouTube', icon: 'play', href: yt(`${o.title} ${o.artist ?? ''}`.trim()) },
    // mai-notes can't be linked to from a title, so this searches that site
    { label: 'Chart viewer', sub: 'mai-notes', icon: 'search', href: `https://www.google.com/search?q=${encodeURIComponent(`site:mai-notes.com ${o.title}`)}` },
  ];
}
