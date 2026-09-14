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

  return (
    <tr className="lb-row" onClick={handleClick} onAuxClick={handleAuxClick}>
      {children}
    </tr>
  );
}