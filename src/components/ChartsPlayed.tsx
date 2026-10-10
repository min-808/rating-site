'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChartRegion } from './chart-region';
import { CHART_DIFFICULTIES, type DifficultyCounts } from '../lib/difficulties';

type Counts = { played: number; total: number };

const fmt = (n: number) => n.toLocaleString('en-US');

// "812 / 2,340", for whichever region the level chart's toggle is on
export default function ChartsPlayed({ na, intl }: { na: Counts; intl: Counts }) {
  const { played, total } = useChartRegion() === 'na' ? na : intl;
  return <>{total > 0 ? `${fmt(played)} / ${fmt(total)}` : fmt(played)}</>;
}

// ---------------------------------------------------------------------------
// the "unique charts played" label, with a popup of the same numbers per difficulty

const DIFFICULTY_LABEL: Record<string, string> = {
  basic: 'basic', advanced: 'advanced', expert: 'expert', master: 'master', remaster: 're:master',
};
// maimai's own difficulty colors, for the little swatch next to each name
const DIFFICULTY_COLOR: Record<string, string> = {
  basic: '#22bb5b', advanced: '#fb9c2d', expert: '#f64861', master: '#9e45e2', remaster: '#dbaaff',
};

/*
 * Placed like the past-names popup (above the label, fading in), but in the page's own
 * colors, the same as the account menu, so it blends in with light and dark mode rather
 * than being the inverted tooltip color. It's drawn on top of the whole page rather than
 * inside the stats card, because the card hides anything that spills outside its corners
 */
const css = `
  /* longhands, plus -webkit- copies: iOS Safari drops the one-line "underline dotted" form,
     which is why the underline went missing on phones */
  .cpl-trigger { cursor: help; border-radius: 3px;
    -webkit-text-decoration-line: underline; text-decoration-line: underline;
    -webkit-text-decoration-style: dotted; text-decoration-style: dotted;
    -webkit-text-decoration-color: rgba(127,127,127,0.6); text-decoration-color: rgba(127,127,127,0.6);
    text-decoration-thickness: 1px; text-underline-offset: 3px; }
  .cpl-trigger:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  /* font-family: it lives on <body>, outside the profile, which is what sets sans-serif */
  .cpl-tip { position: fixed; z-index: 60; font-family: sans-serif; padding: 8px 12px; border-radius: 8px;
    background-color: var(--btn-bg); color: var(--btn-text); border: 1px solid var(--btn-border);
    font-size: 0.8rem; font-weight: normal; line-height: normal; white-space: nowrap;
    box-shadow: 0 6px 20px rgba(0,0,0,0.25); pointer-events: none;
    visibility: hidden; opacity: 0; transition: opacity 0.15s ease-in-out, visibility 0.15s ease-in-out; }
  .cpl-tip.is-open { visibility: visible; opacity: 1; }
  /* the arrow: a small square turned 45deg, in the popup's colors and border, under it
     pointing down at the label (or on top when it opens below) */
  .cpl-tip::after { content: ''; position: absolute; left: var(--cpl-arrow, 15px); width: 8px; height: 8px;
    background: var(--btn-bg); border-right: 1px solid var(--btn-border); border-bottom: 1px solid var(--btn-border);
    top: 100%; transform: translate(0, -4px) rotate(45deg); }
  .cpl-tip.is-below::after { top: auto; bottom: 100%; transform: translate(0, 4px) rotate(225deg); }
  .cpl-head { font-weight: bold; margin-bottom: 4px; padding-bottom: 3px; font-size: 0.72rem;
    color: var(--text-muted); border-bottom: 1px solid var(--btn-border); }
  .cpl-row { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
  .cpl-swatch { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
  .cpl-name { flex: 1; font-weight: bold; letter-spacing: 0.02em; }
  .cpl-count { margin-left: 16px; font-variant-numeric: tabular-nums; text-align: right; }
`;

export function ChartsPlayedLabel({ label, na, intl }: { label: string; na: DifficultyCounts; intl: DifficultyCounts }) {
  const region = useChartRegion();
  const counts = region === 'na' ? na : intl;

  // open on hover (mouse), keyboard focus, or a tap (which pins it until a tap elsewhere)
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number; arrow: number; below: boolean } | null>(null);

  // the popup goes on <body>, so only once the page is in the browser
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // above the label, starting at its left edge, kept on screen; below if there's no room above
  const measure = () => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const t = trigger.getBoundingClientRect();
    const margin = 8;
    const width = document.documentElement.clientWidth;
    const left = Math.min(Math.max(margin, t.left), width - tip.offsetWidth - margin);
    const above = t.top - tip.offsetHeight - 8;
    const below = above < margin;
    setPlace({ top: below ? t.bottom + 8 : above, left, arrow: Math.max(8, t.left - left + 15), below });
  };
  useLayoutEffect(() => { if (open) measure(); }, [open, region]);

  // fixed-position popups don't scroll with the page, so follow the label while it's open
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  // a tap anywhere else, or escape, closes a pinned popup
  useEffect(() => {
    if (!pinned) return;
    const onPointer = (e: PointerEvent) => { if (!triggerRef.current?.contains(e.target as Node)) setPinned(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  const summary = CHART_DIFFICULTIES
    .map((d) => `${DIFFICULTY_LABEL[d]} ${fmt(counts[d]?.played ?? 0)} of ${fmt(counts[d]?.total ?? 0)}`)
    .join(', ');

  return (
    <>
      <style>{css}</style>
      <span
        ref={triggerRef}
        className="cpl-trigger"
        tabIndex={0}
        role="button"
        aria-label={`${label}. by difficulty: ${summary}`}
        aria-expanded={open}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHovered(false); }}
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setFocused(true); }}
        onBlur={() => setFocused(false)}
        onClick={() => setPinned((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned((p) => !p); }
          if (e.key === 'Escape') { setPinned(false); setFocused(false); }
        }}
      >
        {label}
      </span>
      {mounted && createPortal(
        <div
          ref={tipRef}
          className={`cpl-tip${open && place ? ' is-open' : ''}${place?.below ? ' is-below' : ''}`}
          style={{ top: place?.top ?? -9999, left: place?.left ?? -9999, '--cpl-arrow': `${place?.arrow ?? 15}px` } as React.CSSProperties}
          role="tooltip"
          aria-hidden={!open}
        >
          <div className="cpl-head">played by difficulty ({region === 'na' ? 'NA' : 'international'})</div>
          {/* re:master at the top, basic at the bottom */}
          {[...CHART_DIFFICULTIES].reverse().map((d) => (
            <div className="cpl-row" key={d}>
              <span className="cpl-swatch" style={{ background: DIFFICULTY_COLOR[d] }} aria-hidden="true" />
              <span className="cpl-name">{DIFFICULTY_LABEL[d]}</span>
              <span className="cpl-count">
                {fmt(counts[d]?.played ?? 0)}{counts[d]?.total ? ` / ${fmt(counts[d].total)}` : ''}
              </span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
