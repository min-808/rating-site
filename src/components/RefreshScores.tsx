'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * "refresh my scores", in the account menu (AccountButton.tsx): re-reads the player's
 * scores from maimai NET (on the VPS, starting as soon as maimai NET is free), so new
 * scores and lamps show up before the nightly scrape gets to them (which only reads
 * players whose rating changed). Once per Hawaii day.
 * See /api/profile/refresh-scores and the verify server's /refresh-scores.
 *
 * useScoreRefresh(menuOpen) holds the state. It only asks how things stand when the menu
 * opens (not on every page), but once a refresh is going it keeps checking even with the
 * menu closed, and redraws the page when it's done so the new scores show.
 */

export type RefreshStatus = {
  state: 'none' | 'queued' | 'running' | 'done' | 'failed';
  canRefresh: boolean;
  message: string;
};

const POLL_MS = 5_000;

// why you'd need it, under the menu item while it can still be pressed
export const REFRESH_WHY = 'scores only update overnight when your rating changes. missing some? refresh once a day';

export function useScoreRefresh(menuOpen: boolean) {
  const router = useRouter();
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // set once we've seen it waiting or running, so "done" afterwards means fresh scores to load
  const watching = useRef(false);

  const load = async () => {
    const res = await fetch('/api/profile/refresh-scores', { cache: 'no-store' }).catch(() => null);
    const data = res?.ok ? ((await res.json().catch(() => null)) as RefreshStatus | null) : null;
    if (data) setStatus(data);
  };

  // where it stands, each time the menu opens
  useEffect(() => {
    if (menuOpen) void load();
  }, [menuOpen]);

  // while it's waiting or running, keep checking (menu open or not). when it finishes,
  // redraw the page so the new scores show (an open favorites editor keeps its picks)
  const inProgress = status?.state === 'queued' || status?.state === 'running';
  useEffect(() => {
    if (inProgress) {
      watching.current = true;
      const t = setInterval(() => void load(), POLL_MS);
      return () => clearInterval(t);
    }
    if (watching.current && status?.state === 'done') {
      watching.current = false;
      router.refresh();
    }
  }, [inProgress, status?.state, router]);

  const refresh = async () => {
    setSending(true); setError(null);
    const res = await fetch('/api/profile/refresh-scores', { method: 'POST' }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSending(false);
    if (!res?.ok) { setError(data.error ?? 'something went wrong'); if (data.state) setStatus(data); return; }
    setStatus(data);
  };

  // what the item says: used up for today, didn't finish, or the button itself
  const label = status?.state === 'done' || (status && !status.canRefresh && !inProgress && status.state === 'none')
    ? 'refreshed today'
    : status?.state === 'failed' ? 'refresh didn\'t finish' : 'refresh my scores';

  // the line under it: an error, how it's going, or why you'd press it
  const note = error ?? (inProgress ? status?.message : status?.canRefresh ? REFRESH_WHY : status?.message) ?? null;

  return { status, error, sending, inProgress, label, note, refresh, canRefresh: Boolean(status?.canRefresh) };
}
