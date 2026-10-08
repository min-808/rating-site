'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import IdCardIcon from './IdCardIcon';

/**
 * The little id-card icon next to a player's name, like osu!'s: hovering it (or
 * tapping it on a phone, or focusing it with the keyboard) shows the names
 * they've gone by before. Only rendered when there are past names.
 */

const css = `
  .pn { position: relative; display: inline-flex; flex-shrink: 0; }
  .pn-btn { display: inline-flex; align-items: center; justify-content: center; padding: 2px; border: 0;
    border-radius: 4px; background: transparent; color: var(--text-sub); cursor: pointer; }
  .pn-btn:hover, .pn-btn[aria-expanded="true"] { color: var(--text-main); }
  .pn-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

  /* same look as the leaderboard's past-names tooltip: above the icon, fading in */
  .pn-tip { position: absolute; bottom: 130%; left: 0; z-index: 40;
    transform: translateX(var(--pn-shift, 0px));
    padding: 8px 12px; border-radius: 6px; background-color: var(--tooltip-bg); color: var(--tooltip-text);
    font-size: 0.8rem; font-weight: normal; line-height: normal; white-space: nowrap; text-align: left;
    box-shadow: 0px 4px 12px rgba(0,0,0,0.25);
    visibility: hidden; opacity: 0; pointer-events: none;
    transition: opacity 0.15s ease-in-out, visibility 0.15s ease-in-out; }
  .pn-tip.is-open { visibility: visible; opacity: 1; }
  /* the arrow under it, pointing down at the icon. it moves the other way when the
     tooltip is nudged back on screen, so it keeps pointing at the icon */
  .pn-tip::after { content: ''; position: absolute; top: 100%; left: calc(15px - var(--pn-shift, 0px));
    border-width: 5px; border-style: solid;
    border-color: var(--tooltip-bg) transparent transparent transparent; }
  /* not enough room above (a long list near the top of the page): open below instead */
  .pn-tip.is-below { bottom: auto; top: 130%; }
  .pn-tip.is-below::after { top: auto; bottom: 100%;
    border-color: transparent transparent var(--tooltip-bg) transparent; }
  .pn-label { font-weight: bold; margin-bottom: 4px; padding-bottom: 2px; font-size: 0.75rem;
    color: var(--text-muted); border-bottom: 1px solid var(--tooltip-border); }
  .pn-name { padding: 2px 0; }
`;

export default function PastNames({ names }: { names: string[] }) {
    // open from a tap or click; hover and keyboard focus open it on their own
    const [pinned, setPinned] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const tipRef = useRef<HTMLDivElement>(null);
    // opens below the icon instead of above, when there's no room above
    const [below, setBelow] = useState(false);
    const open = pinned || hovered || focused;

    // starts at the icon's left edge, unless that runs off the screen: then nudge it back in.
    // the tooltip is on the page even while hidden (so it can fade), so this runs on load
    // and on resize too, or a hidden one could still make a phone page scroll sideways.
    // it opens above the icon, or below when a long list wouldn't fit above it on screen
    useLayoutEffect(() => {
        const tip = tipRef.current;
        if (!tip) return;
        const place = () => {
            tip.style.setProperty('--pn-shift', '0px');
            const margin = 8;

            const iconTop = wrapRef.current?.getBoundingClientRect().top ?? 0;
            const gap = 8; // roughly the space bottom: 130% leaves above the icon
            setBelow(iconTop - gap - tip.offsetHeight < margin);

            // the page's layout width: phones widen innerWidth to fit anything that overflows
            const width = document.documentElement.clientWidth;
            const { left, right } = tip.getBoundingClientRect();
            const shift = right > width - margin
                ? width - margin - right
                : left < margin ? margin - left : 0;
            tip.style.setProperty('--pn-shift', `${shift}px`);
        };
        place();
        window.addEventListener('resize', place);
        return () => window.removeEventListener('resize', place);
    }, [open]);

    // a tap anywhere else, or escape, closes a pinned card
    useEffect(() => {
        if (!pinned) return;
        const onPointer = (e: PointerEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setPinned(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(false); };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [pinned]);

    if (names.length === 0) return null;

    return (
        <div
            className="pn"
            ref={wrapRef}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHovered(false); }}
        >
            <style>{css}</style>
            <button
                type="button"
                className="pn-btn"
                aria-label={`formerly known as ${names.join(', ')}`}
                aria-expanded={open}
                aria-describedby={open ? 'pn-tip' : undefined}
                onClick={() => setPinned((p) => !p)}
                onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setFocused(true); }}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setFocused(false); setPinned(false); } }}
            >
                <IdCardIcon />
            </button>
            {/* always there, so it can fade in and out */}
            <div className={`pn-tip${open ? ' is-open' : ''}${below ? ' is-below' : ''}`} id="pn-tip" role="tooltip" ref={tipRef} aria-hidden={!open}>
                <div className="pn-label">formerly known as</div>
                {names.map((n) => <div className="pn-name" key={n}>• {n}</div>)}
            </div>
        </div>
    );
}
