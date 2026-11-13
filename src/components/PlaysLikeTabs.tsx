'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * The switch at the top of the "how plays like works" page (app/plays-like): the method, then
 * each worked example. Every panel is rendered (so links to anything inside work); the others are
 * hidden. A link to a tab's id (#example-kisukitsune) or to anything inside one (#step-4) opens
 * that tab and scrolls to it; picking a tab updates the address so it can be shared.
 */
export type PlaysLikeTab = { id: string; label: string; content: ReactNode };

export default function PlaysLikeTabs({ tabs }: { tabs: PlaysLikeTab[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const ids = tabs.map((t) => t.id).join(',');

  useEffect(() => {
    const open = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash) return;
      const tabIds = ids.split(',');
      const tab = tabIds.includes(hash)
        ? hash
        : tabIds.find((id) => document.getElementById(`panel-${id}`)?.querySelector(`[id="${CSS.escape(hash)}"]`));
      if (!tab) return;
      setActive(tab);
      // after the panel shows, bring the target into view (the tab's own id: the top of the switch)
      requestAnimationFrame(() => document.getElementById(tabIds.includes(hash) ? 'plays-like-tabs' : hash)?.scrollIntoView());
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [ids]);

  const pick = (id: string) => {
    setActive(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <div id="plays-like-tabs" className="pl-tabs-wrap">
      <div className="pl-tabs" role="tablist" aria-label="explanation or examples">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={active === t.id} aria-controls={`panel-${t.id}`}
            className={active === t.id ? 'is-on' : undefined} onClick={() => pick(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
