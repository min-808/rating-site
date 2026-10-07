/**
 * Who's allowed to touch maimai NET right now. Server-only.
 *
 * The VPS logs into maimai NET with one CLAL cookie, and only one thing can use it
 * at a time. So:
 *
 *   1. closed hours: claims can't run while the scrapers are using maimai NET.
 *      a claim also can't start if its verify window would run into closed hours
 *   2. one claim at a time, site-wide: starting a claim takes "the slot" (a single
 *      document in the `locks` collection). it's given back as soon as that claim
 *      verifies, is cancelled, or runs out of checks, and expires on its own when
 *      the verify window ends, so an abandoned claim can't hold it forever
 *
 * All times are Hawaii time (Pacific/Honolulu). Hawaii has no daylight saving,
 * so it's always UTC-10 and the math below can use a fixed offset.
 */
import { getDb } from './auth';

// time to change the title and press verify. also how long a claim holds the slot
export const VERIFY_MINUTES = 5;

// ---------------------------------------------------------------------------
// closed hours

// how long each "every 4th hour" block lasts, from the top of the hour.
// 60 = the whole hour. if your 4-hourly job only takes ~15 minutes, set 15
// how long each "every 8th hour" block lasts, from the top of the hour.
// 60 = the whole hour. if your 8-hourly job only takes ~15 minutes, set 15
const EVERY_8TH_HOUR_MINUTES = 60;

// [start, end) in minutes after midnight, Hawaii time
const CLOSED: Array<[number, number]> = [
  // 12am, 8am, 4pm
  ...[0, 8, 16].map((h): [number, number] => [h * 60, h * 60 + EVERY_8TH_HOUR_MINUTES]),
  // 11:00pm to 11:45pm
  [23 * 60, 23 * 60 + 45],
];

const MINUTE = 60_000;
const DAY = 86_400_000;
const HAWAII_OFFSET = -10 * 60 * MINUTE;

export type ClosedWindow = { from: Date; until: Date };

/**
 * The first closed window that overlaps [from, to), or null if that whole stretch
 * is open. Back-to-back windows are merged, so `until` is when claims really reopen.
 */
export function closedWindowDuring(from: Date, to: Date = from): ClosedWindow | null {
  const start = from.getTime();
  const end = Math.max(to.getTime(), start + 1);
  // midnight Hawaii time on the day `from` falls on, as a UTC timestamp
  const midnight = Math.floor((start + HAWAII_OFFSET) / DAY) * DAY - HAWAII_OFFSET;

  // every window from yesterday through two days out, in time order
  const windows: Array<[number, number]> = [];
  for (let day = -1; day <= 2; day++) {
    for (const [a, b] of CLOSED) windows.push([midnight + day * DAY + a * MINUTE, midnight + day * DAY + b * MINUTE]);
  }
  windows.sort((x, y) => x[0] - y[0]);

  for (let i = 0; i < windows.length; i++) {
    const [a, b] = windows[i];
    if (a >= end || b <= start) continue;
    let until = b;
    // merge windows that touch or overlap (e.g. 11pm-11:45pm runs nearly into 12am)
    for (let j = i + 1; j < windows.length && windows[j][0] <= until; j++) until = Math.max(until, windows[j][1]);
    return { from: new Date(a), until: new Date(until) };
  }
  return null;
}

// "11:45pm", Hawaii time, for server-side messages
export function hawaiiTime(date: Date) {
  return date
    .toLocaleTimeString('en-US', { timeZone: 'Pacific/Honolulu', hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, '')
    .toLowerCase();
}

// the message a visitor sees when closed hours stop them
export function closedMessage(window: ClosedWindow, now = new Date()) {
  return window.from <= now
    ? `claims are paused right now. try again after ${hawaiiTime(window.until)} hawaii time`
    : `claims pause at ${hawaiiTime(window.from)} hawaii time, which is too soon to finish one. try again after ${hawaiiTime(window.until)} hawaii time`;
}

// ---------------------------------------------------------------------------
// the one-claim-at-a-time slot

type LockDoc = { _id: string; holder: string; until: Date };
const SLOT = 'maimai-net';

async function locks() {
  return (await getDb()).collection<LockDoc>('locks');
}

/**
 * Takes the slot for `holder` until `until`. Works if the slot is free, expired,
 * or already held by one of `holders` (a browser restarting its own claim).
 * Returns null on success, or when the current holder lets go.
 *
 * It's one atomic upsert: if someone else holds a live slot, the filter misses,
 * the upsert tries to insert a second doc with the same _id, and MongoDB refuses
 * with a duplicate key error. Two people pressing start at the same moment can't
 * both win.
 */
export async function takeSlot(holder: string, until: Date, alsoMine: Array<string | null> = []) {
  const col = await locks();
  const mine = [holder, ...alsoMine.filter((h): h is string => Boolean(h))];
  try {
    await col.updateOne(
      { _id: SLOT, $or: [{ until: { $lte: new Date() } }, { holder: { $in: mine } }] },
      { $set: { holder, until } },
      { upsert: true },
    );
    return null;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const current = await col.findOne({ _id: SLOT });
    return current?.until ?? new Date(Date.now() + MINUTE);
  }
}

// gives the slot back, but only if `holder` still has it
export async function releaseSlot(holder: string) {
  await (await locks()).deleteOne({ _id: SLOT, holder });
}

// when the slot frees up if someone (other than `holder`) has it, else null
export async function slotBusyUntil(holder: string | null = null) {
  const current = await (await locks()).findOne({ _id: SLOT, until: { $gt: new Date() } });
  if (!current || (holder && current.holder === holder)) return null;
  return current.until;
}

export function busyMessage(until: Date, now = new Date()) {
  const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / MINUTE));
  return `someone else is claiming a profile right now. try again in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}