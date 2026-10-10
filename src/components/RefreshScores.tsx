'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingDots from './LoadingDots';

/**
 * "refresh my scores", in the favorites editor: re-reads the owner's scores from
 * maimai NET (on the VPS, within a minute), so a score from today can be picked as a
 * favorite before the nightly scrape gets to it. Once per Hawaii day.
 * See /api/profile/refresh-scores and rating-scraper/refresh-worker.js.
 */

type Status = {
  state: 'none' | 'queued' | 'running' | 'done' | 'failed';
  canRefresh: boolean;
  message: string;
};

const POLL_MS = 5_000;

const css = `
  .rf { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 0.75rem; padding-top: 0.75rem;
    border-top: 1px solid var(--border-light); font-size: 0.8rem; color: var(--text-sub); }
  .rf-btn { border: 0; border-radius: 8px; padding: 6px 14px; font: inherit; font-size: 0.85rem; font-weight: 700;
    cursor: pointer; background: rgba(127,127,127,0.22); color: inherit; white-space: nowrap; }
  .rf-btn:hover:not(:disabled) { background: rgba(127,127,127,0.34); }
  .rf-btn:disabled { opacity: 0.55; cursor: default; }
  .rf-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .rf-msg { flex: 1; min-width: 12rem; }
  .rf-error { color: #e11d48; }
`;

export default function RefreshScores() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // set once we've seen it waiting or running, so "done" afterwards means fresh scores to load
  const watching = useRef(false);

  const load = async () => {
    const res = await fetch('/api/profile/refresh-scores', { cache: 'no-store' }).catch(() => null);
    const data = res?.ok ? ((await res.json().catch(() => null)) as Status | null) : null;
    if (data) setStatus(data);
  };

  // where it stands, when the editor opens
  useEffect(() => { void load(); }, []);

  // while it's waiting or running, keep checking. when it finishes, redraw the profile so
  // the new scores are in the chart picker (the editor and its picks stay as they are)
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

  return (
    <div className="rf">
      <style>{css}</style>
      <button type="button" className="rf-btn" onClick={refresh} disabled={sending || !status?.canRefresh}>
        {sending ? <LoadingDots label="asking" />
          : inProgress ? <LoadingDots label="refreshing" />
          : 'refresh my scores'}
      </button>
      <span className={`rf-msg${error ? ' rf-error' : ''}`} aria-live="polite">
        {error ?? status?.message ?? ''}
      </span>
    </div>
  );
}
