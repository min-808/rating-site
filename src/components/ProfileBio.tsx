'use client';

import { useEffect, useRef, useState } from 'react';
import { BIO_MAX_CHARS, bioLength, checkBio, cleanBio } from '../lib/bio';
import LoadingDots from './LoadingDots';

/**
 * The "about me" card on a profile, under the rating and rank card. Everyone sees the bio (or "no bio yet");
 * the profile's signed-in owner also gets a pencil that turns it into an editor.
 *
 * The bio is shown as plain text: React escapes it, so nobody can sneak HTML or
 * scripts in. Line breaks are kept.
 */

const css = `
  /* its own card under the rating / rank / chart card, same width and corners */
  .pb-card { margin: 0 0 1.5rem; padding: 0.75rem 1rem 0.9rem; border: 1px solid var(--border-light);
    border-radius: 12px; font-size: 0.9rem; line-height: 1.55; }
  .pb-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 0.35rem; }
  .pb-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; color: var(--text-sub); }
  .pb-text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .pb-empty { margin: 0; color: var(--text-muted, var(--text-sub)); font-style: italic; }
  .pb-pencil { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;
    border: 0; border-radius: 7px; background: transparent; color: var(--text-sub); cursor: pointer; }
  .pb-pencil:hover { background: rgba(127,127,127,0.14); color: #2563eb; }
  .pb-pencil:focus-visible, .pb-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .pb-area { width: 100%; box-sizing: border-box; min-height: 6.5rem; resize: vertical; font: inherit;
    padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-light); background: transparent; color: inherit; }
  .pb-area:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .pb-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 0.5rem; }
  .pb-count { font-size: 0.75rem; color: var(--text-sub); font-variant-numeric: tabular-nums; }
  .pb-count-over { color: #e11d48; font-weight: 700; }
  .pb-actions { display: flex; gap: 8px; }
  .pb-btn { border: 0; border-radius: 8px; padding: 6px 14px; font: inherit; font-size: 0.85rem; font-weight: 700;
    cursor: pointer; background: #2563eb; color: #fff; }
  .pb-btn:hover:not(:disabled) { background: #1d4ed8; }
  .pb-btn:disabled { opacity: 0.55; cursor: default; }
  /* secondary buttons: filled gray, like the claim panel's, not just an outline */
  .pb-btn-quiet { background: rgba(127,127,127,0.22); color: inherit; }
  .pb-btn-quiet:hover:not(:disabled) { background: rgba(127,127,127,0.34); }
  .pb-error { margin: 0.5rem 0 0; padding: 6px 10px; border-radius: 7px; font-size: 0.82rem;
    background: rgba(225, 29, 72, 0.12); color: #e11d48; }
`;

// also used by the favorites card, so the two edit buttons match
export function PencilIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    );
}

export default function ProfileBio({ initialBio, canEdit }: {
    initialBio: string | null;
    canEdit: boolean; // the signed-in visitor owns this profile
}) {
    const [bio, setBio] = useState(initialBio);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const areaRef = useRef<HTMLTextAreaElement>(null);

    // the page re-rendered with fresh data (e.g. after signing in): follow it
    useEffect(() => { setBio(initialBio); }, [initialBio]);

    useEffect(() => {
        if (!editing || !areaRef.current) return;
        const el = areaRef.current;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, [editing]);

    const startEditing = () => { setDraft(bio ?? ''); setError(null); setEditing(true); };
    const cancel = () => { setEditing(false); setError(null); };

    const cleaned = cleanBio(draft);
    const length = bioLength(cleaned);
    const problem = checkBio(cleaned);
    const unchanged = cleaned === (bio ?? '');

    const save = async () => {
        if (problem || busy) return;
        if (unchanged) { setEditing(false); return; }
        setBusy(true); setError(null);
        const res = await fetch('/api/profile/bio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bio: draft }),
        }).catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        setBusy(false);
        if (!res?.ok) { setError(data.error ?? 'something went wrong'); return; }
        setBio(data.bio ?? null);
        setEditing(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') cancel();
        // ctrl+enter / cmd+enter saves
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); }
    };

    return (
        <section className="pb-card" aria-label="about me">
            <style>{css}</style>
            <div className="pb-head">
                <span className="pb-label">about me</span>
                {canEdit && !editing && (
                    <button type="button" className="pb-pencil" onClick={startEditing}
                        aria-label="edit your bio" title="edit your bio">
                        <PencilIcon />
                    </button>
                )}
            </div>

            {editing ? (
                <>
                    <textarea ref={areaRef} className="pb-area" value={draft} onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={onKeyDown} placeholder="say something about yourself"
                        aria-label="your bio" maxLength={BIO_MAX_CHARS * 2} />
                    <div className="pb-foot">
                        <span className={`pb-count${problem ? ' pb-count-over' : ''}`}>
                            {problem ?? `${length} / ${BIO_MAX_CHARS}`}
                        </span>
                        <div className="pb-actions">
                            <button type="button" className="pb-btn pb-btn-quiet" onClick={cancel} disabled={busy}>cancel</button>
                            <button type="button" className="pb-btn" onClick={save} disabled={busy || Boolean(problem)}>
                                {busy ? <LoadingDots label="saving" /> : 'save'}
                            </button>
                        </div>
                    </div>
                    {error && <p className="pb-error">{error}</p>}
                </>
            ) : bio ? (
                <p className="pb-text">{bio}</p>
            ) : (
                <p className="pb-empty">{canEdit ? 'no bio yet. press the pencil to add one' : 'no bio yet'}</p>
            )}
        </section>
    );
}