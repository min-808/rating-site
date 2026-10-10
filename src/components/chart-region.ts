'use client';

import { useSyncExternalStore } from 'react';

/**
 * Which region the profile's chart counts are shown for: NA leaves out songs that
 * aren't available in North America, intl counts everything. The level chart's
 * toggle sets it, and anything else on the page that shows those counts (like
 * "unique charts played") follows along.
 *
 * It lives in this module rather than in one component's state, because the
 * pieces that use it sit in different parts of the page.
 */

export type Region = 'na' | 'intl';

let region: Region = 'na';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setChartRegion(next: Region) {
  if (next === region) return;
  region = next;
  listeners.forEach((l) => l());
}

// the current region, re-rendering whenever it changes. the server always draws NA
export function useChartRegion(): Region {
  return useSyncExternalStore(subscribe, () => region, () => 'na');
}
