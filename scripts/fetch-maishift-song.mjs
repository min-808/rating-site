/**
 * node scripts/fetch-maishift-song.mjs                        every song (skips what's already saved)
 * node scripts/fetch-maishift-song.mjs "LEMON MELON COOKIE"   one song
 * node scripts/fetch-maishift-song.mjs --dry-run              only say how much there is left to fetch
 * node scripts/fetch-maishift-song.mjs --fresh                fetch everything again, ignoring what's saved
 *
 * Fetches what "plays like" needs from maishift and saves it as maishift-levels.json, ready to
 * import into the `maishift_levels` collection in Compass. It never touches the database itself.
 *
 * For each chart at 11.0 or above (below that, maishift's rating bands don't reach the chart's
 * level): every chart's rank counts within 0.5 of its constant, for each rating band within 750
 * of the chart's center rating (an SSS+ on it x 50). That's what the site compares the chart
 * against (lib/maishift-feel.ts).
 *
 * maishift-levels.json is also the log of what's been fetched: a constant + rating band that's
 * already in it is skipped, and the file is saved after every call, so stopping it (Ctrl+C) and
 * running it again carries on where it left off.
 *
 * Reads MAISHIFT_API_KEY from .env, never prints it, and paces itself by maishift's rate
 * limit (X-RateLimit-Remaining), so it never gets rate limited.
 *
 * The file holds:
 *   one document per constant: { _id: 133, constant: 13.3, region, fetchedAt,
 *     bands: { "14750-15000": [{ id, n, c: [<94, AAA, S, S+, SS, SS+, SSS, SSS+, AP+] }] } }
 *     (n: players with a counted score. charts with fewer than 5 players are left out)
 *   one { _id: "charts" } document: maishift chart id -> { title, type, difficulty, version }
 */
import fs from 'node:fs';

const BASE = 'https://maimai.shiftpsh.com/api/v1';
const REGION = 'na';
const OUT = 'maishift-levels.json';
const COST = { versions: 1, songs: 10, levelCharts: 15 };
// how far either side of a chart's constant its comparison charts reach, in tenths (0.5): the
// site fits a line through them to measure how much accuracy one level of constant is worth
const REACH = 5;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fresh = args.includes('--fresh');
const title = args.find((a) => !a.startsWith('--'));

// the key, from .env (KEY=value lines). never printed
function readKey() {
  if (process.env.MAISHIFT_API_KEY) return process.env.MAISHIFT_API_KEY;
  const text = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*MAISHIFT_API_KEY\s*=\s*(.*)\s*$/);
    if (match) return match[1].replace(/^['"]|['"]$/g, '');
  }
  return null;
}

const key = readKey();
if (!key) { console.error('MAISHIFT_API_KEY is not set in .env'); process.exit(1); }

// the rate limit: 120 units, refilling 2 a second. before each call, wait until there's enough
let remaining = 120;
let calls = 0;
let units = 0;
let bytes = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// maishift's server having a bad moment (502, 503, 504, a dropped connection): wait and try
// again, 15s, 30s, 60s, 2 min, 4 min, before giving up. what's already saved stays saved
const RETRY_WAITS = [15, 30, 60, 120, 240];

async function get(path, cost) {
  if (remaining < cost + 5) await sleep(((cost + 5 - remaining) / 2) * 1000 + 500);
  let serverErrors = 0;
  for (;;) {
    let res;
    try {
      res = await fetch(BASE + path, { headers: { 'X-API-Key': key } });
    } catch (error) { // no answer at all (connection dropped, wifi blip)
      if (serverErrors >= RETRY_WAITS.length) throw error;
      console.log(`  no answer from maishift (${error.cause?.code ?? error.message}), trying again in ${RETRY_WAITS[serverErrors]}s`);
      await sleep(RETRY_WAITS[serverErrors++] * 1000);
      continue;
    }
    const left = Number(res.headers.get('X-RateLimit-Remaining'));
    if (Number.isFinite(left)) remaining = left;
    if (res.status === 429) { // rate limited anyway: wait as long as maishift says
      const wait = Number(res.headers.get('Retry-After')) || 5;
      console.log(`  rate limited, waiting ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }
    const text = await res.text();
    if (res.status >= 500 && serverErrors < RETRY_WAITS.length) {
      console.log(`  maishift answered ${res.status} (a problem on their side), trying again in ${RETRY_WAITS[serverErrors]}s`);
      await sleep(RETRY_WAITS[serverErrors++] * 1000);
      continue;
    }
    calls += 1; units += cost; bytes += text.length;
    if (!res.ok) throw new Error(`${path}: ${res.status} ${text.slice(0, 200)}  (what's downloaded so far is saved: run the same command again to carry on)`);
    return JSON.parse(text);
  }
}

// a chart's center rating: an SSS+ on it (no AP) x 50, the game's own rounding, at most 16,600
// (the same as lib/plays-like.ts centerRating)
const centerRating = (tenths) => Math.min(Math.floor((Math.min(tenths, 150) * 1005000 * 224) / 100_000_000) * 50, 16600);

// maishift's rating bands: 13000-13500, 13500-14000, then 250 wide up to 17000
const BANDS = [[13000, 13500], [13500, 14000]];
for (let from = 14000; from < 17000; from += 250) BANDS.push([from, from + 250]);

// the bands a chart is compared in: those within 3 rating groups (750) of its center
function bandsFor(tenths) {
  const group = Math.floor(centerRating(tenths) / 250);
  const from = (group - 3) * 250;
  const to = (group + 3) * 250 + 249;
  return BANDS.filter(([a, b]) => a <= to && b - 1 >= from).map(([a, b]) => `${a}-${b}`);
}

const fold = (s) => String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
const started = Date.now();

// what's already saved: the log of what's been fetched
const docs = new Map(); // level -> document
let chartsDoc = { _id: 'charts', region: REGION, fetchedAt: null, charts: {} };
if (!fresh && fs.existsSync(OUT)) {
  for (const doc of JSON.parse(fs.readFileSync(OUT, 'utf8'))) {
    if (doc._id === 'charts') chartsDoc = doc;
    else docs.set(doc._id, doc);
  }
}
const saved = (level, band) => Boolean(docs.get(level)?.bands?.[band]);

// saved after every call (written to a temporary file first, so a stop halfway never breaks it)
function save() {
  const out = [...[...docs.values()].sort((a, b) => a._id - b._id), chartsDoc];
  fs.writeFileSync(OUT + '.tmp', JSON.stringify(out));
  fs.renameSync(OUT + '.tmp', OUT);
  return out.length;
}

const { versions } = await get(`/versions?region=${REGION}`, COST.versions);
const versionName = new Map(versions.map((v) => [v.id, v.name]));
const { songs } = await get(`/songs?region=${REGION}`, COST.songs);

// every chart's details, for matching maishift's ids to the site's charts
const chartInfo = new Map();
for (const song of songs) {
  for (const chart of song.charts) {
    chartInfo.set(chart.id, { title: song.title, type: song.type, difficulty: chart.difficulty, version: versionName.get(song.version) ?? null });
  }
}

const picked = title ? songs.filter((s) => fold(s.title) === fold(title)) : songs;
if (!picked.length) { console.error(`no song called "${title}" on maishift (${REGION})`); process.exit(1); }
const wanted = picked.flatMap((s) => s.charts).filter((c) => c.internalLevel >= 110);
console.log(`${title ?? 'every song'}: ${wanted.length} chart(s) at 11.0 or above`);

// what to fetch: each constant within REACH (0.5), in each of the chart's bands
const jobs = new Map(); // "133|14750-15000" -> { level, band }
for (const chart of wanted) {
  for (let level = chart.internalLevel - REACH; level <= chart.internalLevel + REACH; level++) {
    if (level < 10 || level > 150) continue;
    for (const band of bandsFor(chart.internalLevel)) jobs.set(`${level}|${band}`, { level, band });
  }
}
const todo = [...jobs.values()].filter(({ level, band }) => !saved(level, band)).sort((a, b) => a.level - b.level || a.band.localeCompare(b.band));
const minutes = Math.ceil((todo.length * COST.levelCharts) / 2 / 60);
console.log(`${jobs.size} level/band views needed: ${jobs.size - todo.length} already saved, ${todo.length} to fetch (about ${todo.length * COST.levelCharts} units, ${minutes} min)`);
if (dryRun) process.exit(0);
if (!todo.length) { console.log('nothing new to fetch'); process.exit(0); }

let done = 0;
for (const { level, band } of todo) {
  const data = await get(`/stats/level-charts?region=${REGION}&internalLevel=${level}&rating=${band}`, COST.levelCharts);
  const doc = docs.get(level) ?? { _id: level, constant: level / 10, region: REGION, fetchedAt: new Date().toISOString(), bands: {} };
  doc.bands[band] = data.charts
    .filter((c) => !c.suppressed && c.counts)
    .map((c) => {
      chartsDoc.charts[c.chartId] = chartInfo.get(c.chartId) ?? null;
      const k = c.counts;
      return { id: c.chartId, n: c.players, c: [k.LT_94, k.AAA, k.S, k.S_PLUS, k.SS, k.SS_PLUS, k.SSS, k.SSS_PLUS_WITHOUT_AP, k.ALL_PERFECT_PLUS] };
    });
  docs.set(level, doc);
  chartsDoc.fetchedAt = new Date().toISOString(); // a new date tells the site to work the charts out again
  save();
  done += 1;
  console.log(`  ${done}/${todo.length}  ${level / 10} at ${band}: ${doc.bands[band].length} charts  (rate limit left: ${remaining})`);
}

const count = save();
console.log(`\nsaved ${OUT}: ${count} documents, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
console.log(`${calls} calls, ${units} units, ${(bytes / 1024).toFixed(0)} KB downloaded, ${((Date.now() - started) / 1000).toFixed(0)}s`);
console.log(`next: in Compass, empty maimai.maishift_levels (Delete, filter {}) and import ${OUT} again`);
