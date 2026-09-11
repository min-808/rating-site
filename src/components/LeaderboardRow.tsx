'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode, MouseEvent } from 'react';

interface LeaderboardRowProps {
  href: string;
  children: ReactNode;
}

export default function LeaderboardRow({ href, children }: LeaderboardRowProps) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLTableRowElement>) {
    // the player name is a real <Link>, let it handle its own clicks
    if ((e.target as HTMLElement).closest('a')) return;

    // don't navigate if someone was just highlighting text
    if (window.getSelection()?.toString()) return;

    // ctrl / cmd / shift click opens a new tab like a normal link would
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      window.open(href, '_blank', 'noopener');
      return;
    }

    router.push(href);
  }

  function handleAuxClick(e: MouseEvent<HTMLTableRowElement>) {
    // middle click anywhere on the row opens a new tab
    if (e.button !== 1) return;
    if ((e.target as HTMLElement).closest('a')) return;
    window.open(href, '_blank', 'noopener');
  }

  return (
    <tr className="lb-row" onClick={handleClick} onAuxClick={handleAuxClick}>
      {children}
    </tr>
  );
}