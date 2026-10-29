'use client';

import { useSyncExternalStore } from 'react';

/**
 * Which songs the signed-in player has hearted, shared by every heart on the page. The
 * list is fetched once (the first heart to appear asks), so 60 hearts on /songs make one
 * request, not 60, and it lives as long as the page does. Tapping a heart changes it right
 * away and tells the server; if the server says no, it goes back and says why.
 */

type State = { loaded: boolean; signedIn: boolean; ids: ReadonlySet<string> };

const INITIAL: State = { loaded: false, signedIn: false, ids: new Set() };
let state: State = INITIAL;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

let loading: Promise<void> | null = null;
export function loadFavoriteSongs(): Promise<void> {
  if (!loading) {
    loading = fetch('/api/profile/favorite-songs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { signedIn?: boolean; ids?: string[] }) => set({ loaded: true, signedIn: Boolean(d.signedIn), ids: new Set(d.ids ?? []) }))
      .catch(() => { loading = null; set({ loaded: true }); }); // not signed in as far as we can tell; the next heart tries again
  }
  return loading;
}

/** Heart or un-heart a song. Resolves to an error message, or null when it worked. */
export async function setSongFavorite(id: string, favorite: boolean): Promise<string | null> {
  const before = state.ids;
  const next = new Set(before);
  if (favorite) next.add(id); else next.delete(id);
  set({ ids: next });
  try {
    const res = await fetch('/api/profile/favorite-songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, favorite }),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    set({ ids: before });
    return data.error ?? 'something went wrong';
  } catch {
    set({ ids: before });
    return "couldn't reach the server";
  }
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useFavoriteSongs(): State {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}
