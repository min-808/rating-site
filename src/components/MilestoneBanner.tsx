'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tierAt, tierLabel } from '../lib/rating-tiers';

export type Milestone = {
    name: string;
    href: string;
    milestone: number; // the highest milestone they crossed in the window
    rating: number;
    when: string; // "today", "yesterday", "2 days ago"
};

/**
 * A small, closable announcement for players who crossed a rating milestone in
 * the last few updates. Closing it is remembered in this browser until the next
 * update, so it doesn't keep coming back on every visit, but the next day's
 * milestones still show.
 */

const css = `
  /* sized to its content (up to a max) and centered, in the same blue as the faq highlights */
  .ms-banner { position: relative; width: fit-content; max-width: min(680px, 100%); box-sizing: border-box;
    margin: 0 auto 1.25rem; padding: 10px 48px; min-width: min(420px, 100%); border-radius: 10px; text-align: center;
    font-size: 0.85rem; line-height: 1.5;
    background: var(--faq-highlight-bg); border: 1px solid rgba(23, 89, 233, 0.35); }
  .ms-body { min-width: 0; }
  .ms-title { margin: 0 0 8px; font-weight: bold; font-size: 1.2rem; }
  .ms-list { margin: 0; padding: 0; list-style: none; }
  .ms-list li { margin: 1px 0; }
  .ms-list a { color: inherit; font-weight: 700; text-decoration: none; }
  .ms-list a:hover { color: #2563eb; }
  .ms-num { font-weight: 800; font-variant-numeric: tabular-nums; color: #96b7ff; }
  .ms-when { color: var(--text-sub); }

  /* the badge name in plain text */
  .ms-tier { font-weight: 700; white-space: nowrap; }

  .ms-close { position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center; border: 0; background: transparent;
    color: var(--text-sub); font-size: 1.1rem; line-height: 1; cursor: pointer; }
  .ms-close:hover { background: rgba(127,127,127,0.15); color: inherit; }
  .ms-close:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
`;

export default function MilestoneBanner({ milestones, updateKey }: {
    milestones: Milestone[];
    updateKey: string; // changes with every update, so a closed banner reopens for new milestones
}) {
    const storageKey = `milestone-banner-closed:${updateKey}`;
    // hidden until we've checked whether it was closed, so it never flashes and vanishes
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let closed = false;
        try {
            closed = localStorage.getItem(storageKey) === '1';
        } catch {
            // storage blocked (private mode etc.): just show it
        }
        setVisible(!closed);
    }, [storageKey]);

    if (!visible || milestones.length === 0) return null;

    const close = () => {
        setVisible(false);
        try {
            localStorage.setItem(storageKey, '1');
        } catch {
            // nothing to do, it stays closed for this visit at least
        }
    };

    return (
        <aside className="ms-banner" role="status">
            <style>{css}</style>
            <div className="ms-body">
                <p className="ms-title">
                    {milestones.length === 1 ? 'Recent milestone!' : `${milestones.length} recent milestones!`}
                </p>
                <ul className="ms-list">
                    {milestones.map((m) => {
                        const tier = tierAt(m.milestone);
                        return (
                            <li key={`${m.href}-${m.milestone}`}>
                                <Link href={m.href}>{m.name}</Link> reached{' '}
                                {tier && (
                                    <> <span className="ms-tier">{tierLabel(tier)} </span></>
                                )}
                                <span className="ms-when">{m.when} </span>
                                (<span className="ms-num">{m.milestone.toLocaleString()}</span> rating)
                            </li>
                        );
                    })}
                </ul>
            </div>
            <button type="button" className="ms-close" onClick={close} aria-label="Close announcement">×</button>
        </aside>
    );
}