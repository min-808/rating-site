'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode, MouseEvent } from 'react';
import { useSearchWords } from './LeaderboardSearch';
import { matchesPlayer } from '../lib/player-search';

interface LeaderboardRowProps {
  href: string;
  searchText: string; // lib/player-search.ts: the name and past names, for the search box
  children: ReactNode;
}

export default function LeaderboardRow({ href, searchText, children }: LeaderboardRowProps) {
  const router = useRouter();
  const words = useSearchWords();

  function handleClick(e: MouseEvent<HTMLTableRowElement>) {
    if ((e.target as HTMLElement).closest('a')) return;

    if (window.getSelection()?.toString()) return;

    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      window.open(href, '_blank', 'noopener');
      return;
    }

    router.push(href);
  }

  function handleAuxClick(e: MouseEvent<HTMLTableRowElement>) {
    if (e.button !== 1) return;
    if ((e.target as HTMLElement).closest('a')) return;
    window.open(href, '_blank', 'noopener');
  }

  // the search box is in use and this player isn't a match
  if (words.length > 0 && !matchesPlayer(searchText, words)) return null;

  return (
    <tr className="lb-row" onClick={handleClick} onAuxClick={handleAuxClick}>
      {children}
    </tr>
  );
}