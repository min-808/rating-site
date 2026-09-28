import { MongoClient } from 'mongodb';
import { put } from '@vercel/blob';

// 1) where the song list comes from. This filename changes each game version, so
//    check https://github.com/zvuc/otoge-db/tree/main/maimai/data for the newest one.
const SONGS_URL =
    'https://raw.githubusercontent.com/zvuc/otoge-db/refs/heads/main/maimai/data/music-ex-circleplus-final.json';

// 2) where the cover files live: otoge-db keeps them in its own repo, in maimai/jacket/.
//    Open COVER_BASE + any image_url in your browser first to check.
const COVER_BASE = 'https://raw.githubusercontent.com/zvuc/otoge-db/refs/heads/main/maimai/jacket/';

// otoge-db stores a version as a number code, not a name. Fill in the ones you know;
// songs with an unknown code just get no version band on the card.
const VERSION_NAMES = {
    // '11007': 'MAGiCAL',
};

const FORCE = process.argv.includes('--force'); // re-download even if already saved
const CHECKPOINT_EVERY = 50;   // print a summary line every N songs
const FETCH_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 30_000;
const SLOW_WARNING_MS = 10_000; // print "still working" if one song takes this long
const MAX_CONSECUTIVE_FAILURES = 10; // stop early if this many songs in a row fail

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
const fileOf = (url) => (url ? url.split('?')[0].split('/').pop() : null);
const secs = (ms) => (ms / 1000).toFixed(1) + 's';
const clock = (ms) => `${Math.floor(ms / 60000)}m${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}s`;

// gives up (with an error) instead of hanging forever
function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// downloads a cover; retries once if the host says "slow down" (429) or has a hiccup (5xx)
async function fetchImage(url) {
    let res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status === 429 || res.status >= 500) {
        const wait = Math.min(Number(res.headers.get('retry-after')) || 5, 30);
        await sleep(wait * 1000);
        res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    }
    return res;
}

const started = Date.now();

console.log('Connecting to MongoDB...');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
await client.connect();
const db = client.db('maimai');

console.log('Loading song list from otoge-db...');
const res0 = await fetch(SONGS_URL, { signal: AbortSignal.timeout(60_000) });
if (!res0.ok) throw new Error(`song list: HTTP ${res0.status}`);
const list = await res0.json();
console.log(`  ${list.length} songs in otoge-db`);

const byImage = new Map(list.filter((s) => s.image_url).map((s) => [s.image_url, s]));
const byTitle = new Map();
for (const s of list) {
    const key = norm(s.title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), s]);
}

console.log('Reading songs from your players...');
const rows = await db.collection('players').aggregate([
    { $unwind: '$songs' },
    { $group: { _id: '$songs.title', jacket: { $first: '$songs.jacket' } } },
]).toArray();

const done = FORCE
    ? new Set()
    : new Set((await db.collection('songmeta').find({}).project({ _id: 1 }).toArray()).map((d) => d._id));

const todo = rows.filter((r) => !done.has(r._id));
console.log(`  ${rows.length} distinct songs, ${rows.length - todo.length} already saved, ${todo.length} to do\n`);

// 3) FIND the song: the image filename is the most reliable match, title is the fallback
function findSong({ _id: title, jacket }) {
    const byFile = byImage.get(fileOf(jacket));
    if (byFile) return byFile;
    const sameTitle = byTitle.get(norm(title)) ?? [];
    return sameTitle.length === 1 ? sameTitle[0] : null; // 2+ songs share the title: don't guess
}

// PREFLIGHT: try one cover first, so a wrong URL stops here instead of after 1000+ failures
const sample = todo.map(findSong).find(Boolean);
if (sample) {
    const testUrl = COVER_BASE + sample.image_url;
    const test = await fetchImage(testUrl).catch((e) => ({ ok: false, status: e.message }));
    if (!test.ok) {
        console.log(`Preflight FAILED: ${testUrl}\n  -> ${test.status}\nFix COVER_BASE (open that URL in your browser to check), then run again.`);
        await client.close();
        process.exit(1);
    }
    console.log(`Preflight OK: ${testUrl}\n`);
}

let saved = 0;
let failStreak = 0;
const problems = [];

// what we're doing right now, so the "still working" warning can say what it's stuck on
let current = null;
const heartbeat = setInterval(() => {
    if (current && Date.now() - current.since >= SLOW_WARNING_MS) {
        console.log(`\n  ...still on "${current.title}" (${current.stage}, ${secs(Date.now() - current.since)})`);
    }
}, SLOW_WARNING_MS);

for (let i = 0; i < todo.length; i++) {
    const row = todo[i];
    const t0 = Date.now();
    current = { title: row._id, stage: 'matching', since: t0 };
    // written BEFORE the work starts, so if it hangs you can see exactly which song
    process.stdout.write(`[${i + 1}/${todo.length}] ${row._id} ... `);

    try {
        const song = findSong(row);
        if (!song) throw new Error('no unique match in otoge-db');

        // 4) GET the image
        current.stage = 'downloading';
        const res = await fetchImage(COVER_BASE + song.image_url);
        const type = (res.headers.get('content-type') ?? '').split(';')[0];
        if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
        if (!type.startsWith('image/')) throw new Error(`not an image (${type || 'no type'})`);
        const body = Buffer.from(await res.arrayBuffer());

        // 5) PUT it in Blob. The key is the image filename, so re-runs never duplicate.
        current.stage = 'uploading to Blob';
        const blob = await withTimeout(
            put(`jacket/${song.image_url}`, body, {
                access: 'public',
                addRandomSuffix: false,
                allowOverwrite: true,
                contentType: type,
                cacheControlMaxAge: 60 * 60 * 24 * 365,
            }),
            UPLOAD_TIMEOUT_MS,
            'Blob upload',
        );

        // 6) SAVE the link. page.tsx already reads these fields.
        current.stage = 'saving to MongoDB';
        const name = VERSION_NAMES[song.version];
        await db.collection('songmeta').updateOne(
            { _id: row._id },
            { $set: {
                    blob: blob.url,
                    artist: song.artist,
                    bpm: Number(song.bpm) || undefined,
                    genre: song.catcode,
                    version_code: song.version,
                    ...(name ? { version: name } : {}),
                } },
            { upsert: true },
        );

        saved++;
        failStreak = 0;
        console.log(`OK (${secs(Date.now() - t0)})  ${blob.url}`);
    } catch (e) {
        problems.push(`${row._id}: ${e.message}`);
        failStreak++;
        console.log(`FAILED at ${current.stage} (${secs(Date.now() - t0)}): ${e.message}`);
    }
    current = null;

    if (failStreak >= MAX_CONSECUTIVE_FAILURES) {
        console.log(`\nStopping: ${failStreak} songs in a row failed, so something is probably wrong (URL, token or network). Fix it and run again; saved songs will be skipped.`);
        break;
    }

    if ((i + 1) % CHECKPOINT_EVERY === 0) {
        console.log(`--- ${i + 1}/${todo.length} done | ${saved} saved | ${problems.length} failed | ${clock(Date.now() - started)} elapsed ---`);
    }
    await sleep(150); // go easy on the image host
}

clearInterval(heartbeat);
console.log(`\nFinished in ${clock(Date.now() - started)}: ${saved} saved, ${problems.length} failed`);
problems.forEach((p) => console.log('  !', p));
await client.close();
