'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingDots from './LoadingDots';

/**
 * "refresh my scores", on the far right of the owner's profile header: re-reads their
 * scores from maimai NET (on the VPS, starting as soon as maimai NET is free), so new
 * scores and lamps show up before the nightly scrape gets to them (which only reads
 * players whose rating changed). Once per Hawaii day.
 * See /api/profile/refresh-scores and the verify server's /refresh-scores.
 *
 * The header has little room, so the button's label says where it stands (refreshing,
 * refreshed today). While it can be pressed, a note above it says why you'd need it (the
 * nightly only re-reads players whose rating changed); the line under it only shows
 * while it runs, or on an error.
 * The full message is the button's tooltip.
 */

type Status = {
  state: 'none' | 'queued' | 'running' | 'done' | 'failed';
  canRefresh: boolean;
  message: string;
};

const POLL_MS = 5_000;

const css = `
  /* bottom of the header, just above the rating card */
  .rf { flex-shrink: 0; align-self: flex-end; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
    margin-left: auto; font-family: sans-serif; }
  .rf-btn { border-radius: 9px; padding: 8px 18px; font: inherit; font-size: 0.9rem; font-weight: 700;
    cursor: pointer; color: inherit; white-space: nowrap;
    /* the same fill and edge as the stats card's side panel (total charts played) */
    background: rgba(127,127,127,0.06); border: 1px solid var(--border-light); }
  .rf-btn:hover:not(:disabled) { background: rgba(127,127,127,0.14); }
  .rf-btn:disabled { opacity: 0.6; cursor: default; }
  .rf-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .rf-msg { max-width: 15rem; font-size: 0.72rem; line-height: 1.35; color: var(--text-sub); text-align: right; }
  .rf-error { color: #e11d48; }
  /* above the button: why you'd need it */
  .rf-why { max-width: 15rem; font-size: 0.72rem; line-height: 1.35; color: var(--text-muted); text-align: right; }
  .rf-msg:empty { display: none; }
  /* phones: no room beside the name, so it drops under the header into a box of its own,
     drawn like the stats card below it: the note on the left, the button on the right */
  @media (max-width: 600px) {
    .rf { flex-basis: 100%; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px 12px;
      box-sizing: border-box; margin-left: 0; padding: 0.75rem 1rem; border: 1px solid var(--border-light); border-radius: 12px; }
    .rf-why { flex: 1 1 10rem; max-width: none; text-align: left; }
    .rf-btn { margin-left: auto; padding: 7px 14px; font-size: 0.85rem; }
    .rf-msg { flex-basis: 100%; max-width: none; text-align: left; }
  }
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

  // where it stands, when the profile opens
  useEffect(() => { void load(); }, []);

  // while it's waiting or running, keep checking. when it finishes, redraw the profile so
  // the new scores show (an open favorites editor and its picks stay as they are)
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

  // used up for today: say so on the button itself
  const label = status?.state === 'done' || (status && !status.canRefresh && !inProgress && status.state === 'none')
    ? 'refreshed today'
    : status?.state === 'failed' ? 'refresh didn\'t finish' : '↻ refresh my scores';

  return (
    <div className="rf">
      <style>{css}</style>
      {/* the nightly only re-reads players whose rating changed, which isn't obvious */}
      {status?.canRefresh && (
        <span className="rf-why">scores only update overnight when your rating changes. missing some? refresh once a day</span>
      )}
      <button type="button" className="rf-btn" onClick={refresh} disabled={sending || !status?.canRefresh}
        title={status?.message}>
        {sending ? <LoadingDots label="asking" />
          : inProgress ? <LoadingDots label="refreshing" />
          : label}
      </button>
      <span className={`rf-msg${error ? ' rf-error' : ''}`} aria-live="polite">
        {error ?? (inProgress ? status?.message : '')}
      </span>
    </div>
  );
}
