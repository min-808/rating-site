'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Song } from '../lib/leaderboard';
import { rateSong } from '../lib/song-calc';
import { FAVORITES_MAX, favoriteKey } from '../lib/favorites';
import FallbackImage from './FallbackImage';
import { SongCard, SongDetail, bestFiftyCss, ratingGains, type Selected } from './BestFifty';
import { PencilIcon } from './ProfileBio';

/**
 * Up to five favorite scores (FAVORITES_MAX) on a profile, in a card styled like the
 * "about me" one, drawn with the same score cards and detail popup as the best 50.
 * The owner gets the same pencil: pick charts from their played scores, drag the
 * cards themselves into order, remove them with the × on each card, then save.
 *
 * Favorites are stored as chart keys on the account (accounts.favorites), so a
 * card always shows the chart's latest score.
 */

const css = `
  /* the same card as "about me" (ProfileBio's .pb-card), right under it */
  .fav-card { margin: 0 0 1.5rem; padding: 0.75rem 1rem 0.9rem; border: 1px solid var(--border-light);
    border-radius: 12px; font-size: 0.9rem; line-height: 1.55; }
  .fav-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 0.35rem; }
  .fav-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; color: var(--text-sub); }
  .fav-pencil { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;
    border: 0; border-radius: 7px; background: transparent; color: var(--text-sub); cursor: pointer; }
  .fav-pencil:hover { background: rgba(127,127,127,0.14); color: #2563eb; }
  .fav-pencil:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  /* the same columns as the best 50 (bf-grid), at the same width as the best 50's grid,
     so the cards come out exactly the same size. the best 50 sits 2rem in from the page
     edge; this card's padding and border only take 1rem + 1px, so the grid makes up
     the rest (on phones the best 50 is only 0.5rem in, so this reaches out instead) */
  /* .bf-grid.fav-grid: the best 50 adds its own copy of .bf-grid { margin: 0 } further
     down the page, so this needs to be the more specific rule to win */
  .bf-grid.fav-grid { margin: 0 calc(1rem - 1px); }
  .fav-empty { margin: 0; color: var(--text-muted, var(--text-sub)); font-style: italic; }

  .fav-btn { border: 0; border-radius: 8px; padding: 6px 14px; font: inherit; font-size: 0.85rem; font-weight: 700;
    cursor: pointer; background: #2563eb; color: #fff; }
  .fav-btn:hover:not(:disabled) { background: #1d4ed8; }
  .fav-btn:disabled { opacity: 0.55; cursor: default; }
  .fav-btn-quiet { background: transparent; color: var(--text-sub); border: 1px solid var(--border-light); }
  .fav-btn-quiet:hover:not(:disabled) { background: rgba(127,127,127,0.12); }
  .fav-btn:focus-visible, .fav-icon-btn:focus-visible, .fav-pick:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

  /* editing: drag the cards themselves. the picked-up card follows the pointer (moved
     with a transform), and the rest shuffle into place as it passes over them */
  .fav-hint { margin: 0 0 0.6rem; font-size: 0.8rem; color: var(--text-sub); }
  .fav-grid.is-editing > li { position: relative; touch-action: none; user-select: none; -webkit-user-select: none; }
  .fav-grid.is-editing .bf-card { cursor: grab; }
  .fav-grid.is-editing > li.is-dragging { z-index: 5; }
  .fav-grid.is-editing > li.is-dragging .bf-card { cursor: grabbing; box-shadow: 0 12px 28px rgba(0,0,0,0.5);
    outline: 2px solid #2563eb; outline-offset: 2px; transform: scale(1.04); }
  .fav-remove { position: absolute; top: -8px; left: -8px; z-index: 2; width: 26px; height: 26px; padding: 0;
    border: 2px solid var(--bg-color); border-radius: 50%; background: #e11d48; color: #fff; font: inherit;
    font-size: 0.95rem; font-weight: 700; line-height: 1; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
  .fav-remove:hover { background: #be123c; }
  .fav-remove:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .fav-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 0.9rem; }
  .fav-actions .fav-spacer { flex: 1; }
  .fav-error { margin: 0.5rem 0 0; padding: 6px 10px; border-radius: 7px; font-size: 0.82rem;
    background: rgba(225, 29, 72, 0.12); color: #e11d48; }

  /* the chart picker */
  .fav-dialog { width: min(520px, calc(100vw - 2rem)); max-height: min(640px, calc(100vh - 2rem)); padding: 0;
    border: 1px solid var(--border-light); border-radius: 14px; background: var(--bg-color); color: inherit; }
  .fav-dialog::backdrop { background: rgba(0,0,0,0.55); }
  .fav-dlg { display: flex; flex-direction: column; max-height: inherit; }
  .fav-dlg-head { display: flex; align-items: center; gap: 8px; padding: 0.9rem 1rem 0.6rem; }
  .fav-dlg-head h3 { margin: 0; font-size: 1rem; flex: 1; }
  .fav-search { margin: 0 1rem 0.6rem; font: inherit; padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--border-light); background: transparent; color: inherit; }
  .fav-search:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .fav-results { list-style: none; margin: 0; padding: 0 0.5rem 0.75rem; overflow-y: auto; }
  .fav-pick { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 8px; border: 0; border-radius: 8px;
    background: transparent; color: inherit; font: inherit; font-size: 0.88rem; text-align: left; cursor: pointer; }
  .fav-pick:hover { background: rgba(127,127,127,0.12); }
  .fav-pick-score { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--text-sub); white-space: nowrap; }
  .fav-thumb { width: 34px; height: 34px; border-radius: 6px; object-fit: cover; flex-shrink: 0;
    background: rgba(127,127,127,0.2); pointer-events: none; }
  .fav-item-text { flex: 1; min-width: 0; }
  .fav-item-title { display: block; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fav-item-sub { display: block; font-size: 0.75rem; color: var(--text-sub); }
  .fav-icon-btn { width: 28px; height: 28px; flex-shrink: 0; border: 0; border-radius: 6px; background: transparent;
    color: var(--text-sub); font: inherit; font-size: 0.95rem; cursor: pointer; }
  .fav-icon-btn:hover { background: rgba(127,127,127,0.15); color: var(--text-main); }
  .fav-note { margin: 0; padding: 0.5rem 1rem 1rem; font-size: 0.8rem; color: var(--text-muted); }

  @media (max-width: 600px) {
    .bf-grid.fav-grid { margin: 0 calc(-0.5rem - 1px); }
  }
`;

const DIFF_LABEL: Record<string, string> = {
  basic: 'BASIC', advanced: 'ADVANCED', expert: 'EXPERT', master: 'MASTER', remaster: 'Re:MASTER',
};
const describe = (s: Song) =>
  `${/dx/i.test(s.kind ?? '') ? 'DX' : 'STD'} ${DIFF_LABEL[s.difficulty] ?? s.difficulty}` +
  `${s.internal_difficulty != null ? ` ${s.internal_difficulty.toFixed(1)}` : ''}`;

const MAX_RESULTS = 50;

// how far a press has to move before it counts as picking the card up
const DRAG_START_PX = 6;

export default function FavoriteScores({ songs, initialFavorites, canEdit }: {
  songs: Song[]; // every chart they've played, with jackets and versions
  initialFavorites: string[]; // chart keys, in order
  canEdit: boolean; // the signed-in visitor owns this profile
}) {
  const [saved, setSaved] = useState(initialFavorites);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const pickerRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);

  // the card being carried while editing, if any, and where the pointer is
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  // a press on a card, until it either moves far enough to become a drag or lets go.
  // grabX / grabY: where on the card it was grabbed, so the card doesn't jump
  const press = useRef<{ key: string; id: number; x: number; y: number; grabX: number; grabY: number } | null>(null);

  // the page re-rendered with fresh data (e.g. after signing in): follow it
  useEffect(() => { setSaved(initialFavorites); }, [initialFavorites]);

  // every played chart by key, rated the same way the best 50 rates them
  const byKey = useMemo(() => {
    const map = new Map<string, Song>();
    for (const s of songs) {
      if ((s.achievement ?? 0) > 0) map.set(favoriteKey(s), { ...s, rating: rateSong(s) });
    }
    return map;
  }, [songs]);
  const gains = useMemo(() => ratingGains(songs), [songs]);

  const shown = (editing ? draft : saved).map((k) => byKey.get(k)).filter((s): s is Song => Boolean(s));

  useEffect(() => {
    const d = pickerRef.current;
    if (!d) return;
    if (picking && !d.open) {
      d.showModal();
      // the dialog focuses its first button on its own; start in the search box instead
      searchRef.current?.focus();
    }
    if (!picking && d.open) d.close();
  }, [picking]);

  // the carried card follows the pointer: find where its grid slot is now (it changes as
  // the others shuffle), then shift it from there to under the pointer
  useLayoutEffect(() => {
    const li = dragKey ? gridRef.current?.querySelector<HTMLElement>(`li[data-key="${CSS.escape(dragKey)}"]`) : null;
    if (!li || !pointer || !press.current) return;
    li.style.transform = '';
    const slot = li.getBoundingClientRect();
    li.style.transform =
      `translate(${pointer.x - press.current.grabX - slot.left}px, ${pointer.y - press.current.grabY - slot.top}px)`;
    return () => { li.style.transform = ''; };
  });

  // the picker's list: charts not picked yet, best rating first, filtered by title
  const results = useMemo(() => {
    if (!picking) return [];
    const q = query.trim().toLowerCase();
    const taken = new Set(draft);
    return [...byKey.entries()]
      .filter(([key, s]) => !taken.has(key) && (!q || s.title.toLowerCase().includes(q)))
      .sort(([, a], [, b]) => (b.rating - a.rating) || ((b.achievement ?? 0) - (a.achievement ?? 0)))
      .slice(0, MAX_RESULTS);
  }, [picking, query, draft, byKey]);

  // nobody's picked anything and this isn't their profile: nothing to show
  if (!canEdit && shown.length === 0) return null;

  const startEditing = () => { setDraft(saved.filter((k) => byKey.has(k))); setError(null); setEditing(true); };
  const cancel = () => { setEditing(false); setError(null); };

  // puts `key` at position `to`, shifting the others along
  const moveTo = (key: string, to: number) => setDraft((d) => {
    const from = d.indexOf(key);
    if (from < 0 || to === from || to < 0 || to >= d.length) return d;
    const next = d.filter((k) => k !== key);
    next.splice(to, 0, key);
    return next;
  });
  const remove = (key: string) => setDraft((d) => d.filter((k) => k !== key));
  const add = (key: string) => {
    setDraft((d) => (d.length < FAVORITES_MAX && !d.includes(key) ? [...d, key] : d));
    setPicking(false);
  };

  // dragging a card: works with a mouse or a finger (pointer events, not the browser's
  // own drag and drop, which phones don't support). a press only becomes a drag once it
  // moves a few pixels, so tapping the × still just removes the card
  const onCardPointerDown = (e: React.PointerEvent<HTMLLIElement>, key: string) => {
    if ((e.target as HTMLElement).closest('.fav-remove')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    press.current = { key, id: e.pointerId, x: e.clientX, y: e.clientY, grabX: e.clientX - r.left, grabY: e.clientY - r.top };
  };
  const onCardPointerMove = (e: React.PointerEvent<HTMLLIElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!dragKey) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START_PX) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragKey(p.key);
    }
    setPointer({ x: e.clientX, y: e.clientY });

    // whichever other card is under the pointer gives up its spot
    const over = document.elementsFromPoint(e.clientX, e.clientY)
      .map((el) => el.closest<HTMLElement>('.fav-grid > li'))
      .find((li) => li?.dataset.key && li.dataset.key !== p.key);
    if (over) moveTo(p.key, draft.indexOf(over.dataset.key!));
  };
  const endDrag = () => { press.current = null; setDragKey(null); setPointer(null); };

  const save = async () => {
    setBusy(true); setError(null);
    const res = await fetch('/api/profile/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorites: draft }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setError(data.error ?? 'something went wrong'); return; }
    setSaved(data.favorites ?? draft);
    setEditing(false);
  };

  return (
    <section className="fav-card" aria-label="favorite scores">
      <style>{bestFiftyCss}</style>
      <style>{css}</style>

      <div className="fav-head">
        <span className="fav-label">favorite scores</span>
        {canEdit && !editing && (
          <button type="button" className="fav-pencil" onClick={startEditing}
            aria-label="edit your favorites" title="edit your favorites">
            <PencilIcon />
          </button>
        )}
      </div>

      {editing && (
        <p className="fav-hint">
          {draft.length > 1
            ? 'drag the cards to reorder them. clicking the x removes the chart'
            : draft.length === 1 ? '× removes it' : `pick up to ${FAVORITES_MAX} charts to show off`}
        </p>
      )}

      {shown.length > 0 ? (
        <ul className={`bf-grid fav-grid${editing ? ' is-editing' : ''}`} ref={gridRef}>
          {shown.map((song, i) => {
            const key = favoriteKey(song);
            return (
              <SongCard
                key={key}
                song={song}
                position={i + 1}
                gain={gains.get(key)}
                // while editing, cards are for arranging, not opening
                onOpen={() => { if (!editing) setSelected({ song, position: i + 1, list: 'favorites', size: shown.length }); }}
                itemProps={editing ? {
                  'data-key': key,
                  className: dragKey === key ? 'is-dragging' : undefined,
                  onPointerDown: (e) => onCardPointerDown(e, key),
                  onPointerMove: onCardPointerMove,
                  onPointerUp: endDrag,
                  onPointerCancel: endDrag,
                } : undefined}
                onCardKeyDown={editing ? (e) => {
                  const by = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
                  if (!by) return;
                  e.preventDefault();
                  moveTo(key, i + by);
                } : undefined}
              >
                {editing && (
                  <button type="button" className="fav-remove" onClick={() => remove(key)}
                    aria-label={`remove ${song.title}`} title="remove">×</button>
                )}
              </SongCard>
            );
          })}
        </ul>
      ) : (
        !editing && <p className="fav-empty">no favorites yet. press the pencil to pick up to {FAVORITES_MAX}</p>
      )}

      {editing && (
        <>
          <div className="fav-actions">
            <button type="button" className="fav-btn fav-btn-quiet" onClick={() => { setQuery(''); setPicking(true); }}
              disabled={draft.length >= FAVORITES_MAX}>
              {draft.length >= FAVORITES_MAX ? `${FAVORITES_MAX} picked` : '+ add a chart'}
            </button>
            <span className="fav-spacer" />
            <button type="button" className="fav-btn fav-btn-quiet" onClick={cancel} disabled={busy}>cancel</button>
            <button type="button" className="fav-btn" onClick={save} disabled={busy}>{busy ? 'saving…' : 'save'}</button>
          </div>
          {error && <p className="fav-error">{error}</p>}
        </>
      )}

      <SongDetail entry={selected} gains={gains} onClose={() => setSelected(null)} />

      {/* the chart picker */}
      <dialog ref={pickerRef} className="fav-dialog" aria-label="pick a chart" onClose={() => setPicking(false)}
        onClick={(e) => { if (e.target === pickerRef.current) setPicking(false); }}>
        {picking && (
          <div className="fav-dlg">
            <div className="fav-dlg-head">
              <h3>pick a chart</h3>
              <button type="button" className="fav-icon-btn" onClick={() => setPicking(false)} aria-label="close">×</button>
            </div>
            <input ref={searchRef} className="fav-search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="search your played charts" aria-label="search your played charts" />
            {results.length > 0 ? (
              <ul className="fav-results">
                {results.map(([key, s]) => (
                  <li key={key}>
                    <button type="button" className="fav-pick" onClick={() => add(key)}>
                      <FallbackImage src={s.jacket_blob} fallbackSrc={s.jacket} alt="" className="fav-thumb" width={34} height={34} />
                      <span className="fav-item-text">
                        <span className="fav-item-title">{s.title}</span>
                        <span className="fav-item-sub">{describe(s)}</span>
                      </span>
                      <span className="fav-pick-score">{s.achievement.toFixed(4)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fav-note">no played charts match &quot;{query}&quot;</p>
            )}
            {results.length === MAX_RESULTS && <p className="fav-note">showing your top {MAX_RESULTS}. search to find others</p>}
          </div>
        )}
      </dialog>
    </section>
  );
}
