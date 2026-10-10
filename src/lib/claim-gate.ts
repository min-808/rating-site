/**
 * Who's allowed to touch maimai NET right now. Server-only.
 *
 * The VPS logs into maimai NET with one CLAL cookie, and only one thing can use it
 * at a time. So everything that uses it takes turns with "the slot" (a single
 * document in the `locks` collection):
 *
 *   - a claim takes it on start, and gives it back as soon as it verifies, is
 *     cancelled, or runs out of checks. it expires on its own when the verify
 *     window ends, so an abandoned claim can't hold it forever
 *   - each VPS job (scrapers, song import, friend checker) takes it for as long as it
 *     runs, waiting for any claim in progress to finish first, and gives it back the
 *     moment it's done (rating-scraper/maimai-net.js, holdMaimaiNet). it keeps the
 *     slot alive every minute, so a job that crashes frees it within a few minutes.
 *     it also writes when it expects to finish, for the "claims reopen in about N
 *     minutes" message
 *
 * On top of that, a short backstop: claims are refused from 2 minutes before each
 * VPS job's cron time to 1 minute after, which covers the gap between cron firing and
 * the job taking the slot.
 *
 * All times are Hawaii time (Pacific/Honolulu). Hawaii has no daylight saving,
 * so it's always UTC-10 and the math below can use a fixed offset.
 */
import { getDb } from './auth';

// time to change the title and press verify. also how long a claim holds the slot
export const VERIFY_MINUTES = 5;

// ---------------------------------------------------------------------------
// closed hours

// when each VPS job starts, in minutes after midnight, Hawaii time (the VPS crontab).
// keep these in step with the crontab if it changes
const at = (h: number, m = 0) => h * 60 + m;
const CRON_STARTS = [
  at(0), at(8), at(16), // friend checker (run_friend.sh, every 8 hours)
  at(15), // song import (import-songs.sh)
  at(23, 10), // friends list scrape (scrape-friends.sh)
  at(23, 20), // score scrape (scrape-friend-scores.sh)
];

// the backstop around each one: from 2 minutes before to 1 minute after. once a job is
// running, it holds the slot, which keeps claims out for exactly as long as it takes
const BEFORE_MINUTES = 2;
const AFTER_MINUTES = 1;

// [start, end) in minutes after midnight. the 12am one starts at 11:58pm the day before
// (-2), which closedWindowDuring handles, since it checks yesterday and tomorrow too
const CLOSED: Array<[number, number]> = CRON_STARTS.map((t) => [t - BEFORE_MINUTES, t + AFTER_MINUTES]);

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

// the message a visitor sees when the backstop stops them
export function closedMessage(window: ClosedWindow) {
  return `the site is about to update, so claims are paused for a moment. try again after ${hawaiiTime(window.until)} hawaii time`;
}

// ---------------------------------------------------------------------------
// the one-claim-at-a-time slot

// holder: a claim's id, or "scraper:<job name>" for a VPS job.
// scraper / started_at / expected_done_at: only set by VPS jobs, for the estimate
export type LockDoc = {
  _id: string;
  holder: string;
  until: Date;
  scraper?: string;
  started_at?: Date;
  expected_done_at?: Date | null;
};
const SLOT = 'maimai-net';

export const isScraperLock = (lock: Pick<LockDoc, 'holder'>) => lock.holder.startsWith('scraper:');

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
export async function takeSlot(holder: string, until: Date, alsoMine: Array<string | null> = []): Promise<LockDoc | null> {
  const col = await locks();
  const mine = [holder, ...alsoMine.filter((h): h is string => Boolean(h))];
  try {
    await col.updateOne(
      { _id: SLOT, $or: [{ until: { $lte: new Date() } }, { holder: { $in: mine } }] },
      // a claim's slot carries none of a VPS job's fields
      { $set: { holder, until }, $unset: { scraper: '', started_at: '', expected_done_at: '' } },
      { upsert: true },
    );
    return null;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    // whoever has it (they may have let go in the meantime: then say "a minute")
    return (await col.findOne({ _id: SLOT })) ?? { _id: SLOT, holder: '', until: new Date(Date.now() + MINUTE) };
  }
}

// gives the slot back, but only if `holder` still has it
export async function releaseSlot(holder: string) {
  await (await locks()).deleteOne({ _id: SLOT, holder });
}

// the slot, if someone (other than `holder`) has it right now, else null
export async function slotHeldBy(holder: string | null = null): Promise<LockDoc | null> {
  const current = await (await locks()).findOne({ _id: SLOT, until: { $gt: new Date() } });
  if (!current || (holder && current.holder === holder)) return null;
  return current;
}

// what each VPS job is doing, in the "the site is ... right now" message
const JOB_LABEL: Record<string, string> = {
  'friend-check': 'checking for new players',
  'import-songs': 'importing new songs',
  'friends-list': 'updating ratings',
  'friend-scores': 'updating scores',
  'friend-scores-one': "refreshing a player's scores",
};

const inMinutes = (ms: number) => {
  const minutes = Math.max(1, Math.ceil(ms / MINUTE));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
};

// when claims should reopen: a VPS job's own estimate, or when a claim's slot runs out
export function slotFreeAt(lock: LockDoc) {
  return isScraperLock(lock) ? lock.expected_done_at ?? null : lock.until;
}

// the message a visitor sees when the slot is taken: a VPS job (with its estimate), or a claim
export function busyMessage(lock: LockDoc, now = new Date()) {
  if (!isScraperLock(lock)) {
    return `someone else is claiming a profile right now. try again in ${inMinutes(lock.until.getTime() - now.getTime())}`;
  }
  const doing = JOB_LABEL[lock.scraper ?? lock.holder.slice('scraper:'.length)] ?? 'updating';
  const done = lock.expected_done_at ? new Date(lock.expected_done_at).getTime() - now.getTime() : null;
  const when = done == null
    ? 'it usually only takes a few minutes'
    : done > 0
      ? `probably in about ${inMinutes(done)}`
      : "it's taking a little longer than usual";
  return `the site is ${doing} right now, so claims are paused. they reopen as soon as it's done: ${when}`;
}