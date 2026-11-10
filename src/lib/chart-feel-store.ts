import { connectMongo } from './connect-db';
import { getCatalog, catalogByTitle, songForScore } from './song-catalog';
import { chartId } from './song-view';
import { createHash } from 'node:crypto';
import { chartGaps, finishFeels, SCORE_FLOOR, type ChartFeel, type PlayerBaseline } from './plays-like';
import { playerBaseline } from './player-baselines';
import { maishiftData, maishiftFeel, maishiftKey, type MaishiftChartsDoc, type MaishiftLevelDoc } from './maishift-feel';

/**
 * The saved "plays like" results (lib/plays-like.ts), so a song page reads one small
 * document per chart instead of working it out from everyone's scores on every view.
 *
 *   chart_feel           one document per chart: { _id: "<song id>|dx-master", feel, constant, version }
 *   metadata/chart_feel  a fingerprint of every level: tenths of constant -> [scores, sum of
 *                        accuracy, sum of the players' ratings], and when it last ran
 *
 * refreshChartFeels() reads every player's scores and fingerprints each level. When nothing
 * changed since last time (no new or better score, no rating moved, no new chart, same
 * FEEL_VERSION), it stops there. Otherwise every chart is worked out again in memory (a
 * chart's result depends on the charts it's compared with, lib/plays-like.ts), and only the
 * charts whose result actually changed are written.
 *
 * It runs after the nightly scrape (/api/update-leaderboard) and after a player's "refresh
 * my scores" finishes. In development, /api/chart-feel/refresh runs it by hand. Server only.
 */

/** Bump when the way "plays like" is worked out changes: every chart is worked out again on the next run. */
const FEEL_VERSION = 9; // 3: only half the change kept. 4: unused fields dropped. 5: compared with same-era charts, popularity corrected. 6: cap 0.5. 7: maishift's data where it has some. 8: K 0.4. 9: K 0.2
const COLLECTION = 'chart_feel';
/** Documents written per second, at most: half the free Atlas tier's 100 operations a second, leaving the rest for the site. */
const WRITES_PER_SECOND = 50;
const META_ID = 'chart_feel';

type LevelPrint = [number, number, number]; // [scores, sum of accuracy, sum of ratings]
type ScoreDoc = { title: string; genre?: string | null; kind?: string; difficulty?: string; internal_difficulty?: number | null; achievement?: number | null };
type FeelDoc = { _id: string; songId: string; chart: string; constant: number; version: number; hash: string; feel: ChartFeel; updatedAt: Date };

/** A short fingerprint of a result, to tell whether it changed without reading it back. */
const hashOf = (feel: ChartFeel) => createHash('sha1').update(JSON.stringify(feel)).digest('base64url').slice(0, 16);

const diffKey = (d: string | undefined) => String(d ?? '').toLowerCase().replace(/[^a-z]/g, '');
const kindOf = (kind: string | undefined) => (/dx/i.test(kind ?? '') ? 'dx' : 'standard');
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** A chart's saved result's id: "<song id>|dx-master". */
export const chartFeelId = (songId: string, chart: { kind: string; difficulty: string }) => `${songId}|${chartId(chart)}`;

/** The saved results for one song's charts: chart id ("dx-master") -> result. Charts not worked out yet are missing. */
export async function getChartFeels(songId: string, charts: Array<{ kind: string; difficulty: string }>): Promise<Record<string, ChartFeel>> {
  const client = await connectMongo();
  const docs = await client.db('maimai').collection<FeelDoc>(COLLECTION)
    .find({ _id: { $in: charts.map((c) => chartFeelId(songId, c)) } }, { projection: { chart: 1, feel: 1 } })
    .toArray();
  return Object.fromEntries(docs.map((d) => [d.chart, d.feel]));
}

export type RefreshResult = { skipped?: string; players: number; levelsChanged: number; chartsChecked: number; chartsUpdated: number; fromMaishift?: number; ms: number };

/**
 * Updates the saved results where scores changed. force: work every chart out again even when nothing
 * seems to have changed (still only writing the ones whose result did).
 * minIntervalMs: do nothing if it last ran more recently than this (a player's refresh can
 * report "done" on every visit to the editor; this keeps it to one run).
 */
export async function refreshChartFeels({ force = false, minIntervalMs = 0 } = {}): Promise<RefreshResult> {
  const started = Date.now();
  const db = (await connectMongo()).db('maimai');
  const meta = await db.collection<{ _id: string; levels?: Record<string, LevelPrint>; lastRun?: Date; maishiftStamp?: string | null }>('metadata').findOne({ _id: META_ID });
  if (!force && minIntervalMs && meta?.lastRun && started - new Date(meta.lastRun).getTime() < minIntervalMs) {
    return { skipped: 'ran recently', players: 0, levelsChanged: 0, chartsChecked: 0, chartsUpdated: 0, ms: Date.now() - started };
  }

  const [catalog, players, maishiftDocs] = await Promise.all([
    getCatalog(),
    db.collection('players').find(
      { scores_opt_out: { $ne: true }, rating: { $gt: 0 } },
      { projection: { _id: 0, web_id: 1, rating: 1, 'songs.title': 1, 'songs.genre': 1, 'songs.kind': 1, 'songs.difficulty': 1, 'songs.internal_difficulty': 1, 'songs.achievement': 1 } },
    ).toArray(),
    // maishift's numbers, imported from scripts/fetch-maishift-song.mjs (lib/maishift-feel.ts)
    db.collection<MaishiftLevelDoc | MaishiftChartsDoc>('maishift_levels').find({} as object).toArray(),
  ]);
  const songsByTitle = catalogByTitle(catalog);
  const maishift = maishiftData(maishiftDocs as Array<MaishiftLevelDoc | MaishiftChartsDoc>);
  const maishiftStamp = maishift?.fetchedAt ?? null; // a new import counts as a change too

  // everyone's usual scores, every chart's scores, and each level's fingerprint
  const baselines: Record<string, PlayerBaseline> = {};
  const chartScores = new Map<string, Array<{ webId: number; achievement: number }>>();
  const levels: Record<string, LevelPrint> = {};
  for (const p of players) {
    const scores = (p.songs ?? []) as ScoreDoc[];
    baselines[p.web_id] = playerBaseline(p.rating, scores);
    for (const s of scores) {
      if (s.achievement == null || !(s.achievement > 0)) continue;
      if (s.internal_difficulty != null) {
        const print = levels[Math.round(s.internal_difficulty * 10)] ??= [0, 0, 0];
        print[0] += 1;
        print[1] += Math.max(SCORE_FLOOR, s.achievement);
        print[2] += Number(p.rating) || 0;
      }
      const song = songForScore(songsByTitle, s);
      if (!song) continue;
      const id = chartFeelId(song.id, { kind: kindOf(s.kind), difficulty: diffKey(s.difficulty) });
      const list = chartScores.get(id) ?? [];
      list.push({ webId: p.web_id, achievement: s.achievement });
      chartScores.set(id, list);
    }
  }
  for (const print of Object.values(levels)) { print[1] = round4(print[1]); }

  // the levels that changed since last time (all of them, the first time)
  const before = meta?.levels ?? {};
  const changed = new Set<number>();
  for (const tenth of new Set([...Object.keys(levels), ...Object.keys(before)])) {
    const a = levels[tenth];
    const b = before[tenth];
    if (!a || !b || a[0] !== b[0] || Math.abs(a[1] - b[1]) > 1e-3 || a[2] !== b[2]) changed.add(Number(tenth));
  }

  // what's saved now, to spot new charts, changed constants, and an older way of working it out
  const saved = new Map(
    (await db.collection<FeelDoc>(COLLECTION).find({}, { projection: { constant: 1, version: 1, hash: 1 } }).toArray())
      .map((d) => [d._id, d]),
  );
  const charts = catalog.flatMap((song) => song.charts.map((chart) => ({ song, chart, id: chartFeelId(song.id, chart) })));
  const outdated = charts.some(({ id, chart }) => {
    const old = saved.get(id);
    return !old || old.version !== FEEL_VERSION || old.constant !== chart.internal;
  });
  if (!force && changed.size === 0 && !outdated && (meta?.maishiftStamp ?? null) === maishiftStamp) {
    await db.collection('metadata').updateOne({ _id: META_ID } as object, { $set: { lastRun: new Date() } }, { upsert: true });
    return { players: players.length, levelsChanged: 0, chartsChecked: charts.length, chartsUpdated: 0, fromMaishift: 0, ms: Date.now() - started };
  }

  // every chart, worked out together (lib/plays-like.ts): each on its own, then against each other
  const results = finishFeels(charts.map(({ song, chart, id }) => chartGaps(chart.internal, song.versionCode, chartScores.get(id) ?? [], baselines)));

  // where maishift has numbers for a chart, those replace this site's (far more players)
  let fromMaishift = 0;
  if (maishift) {
    charts.forEach(({ song, chart }, i) => {
      const maishiftId = song.titles.map((t) => maishift.byChart.get(maishiftKey(t, chart.kind, chart.difficulty))).find((x) => x != null);
      if (maishiftId == null) return;
      const feel = maishiftFeel(chart.internal, song.versionCode, maishiftId, maishift);
      if (feel?.playsLike != null) { results[i] = feel; fromMaishift += 1; }
    });
  }

  const writes: Array<{ replaceOne: { filter: { _id: string }; replacement: FeelDoc; upsert: true } }> = [];
  charts.forEach(({ song, chart, id }, i) => {
    const feel = results[i];
    const hash = hashOf(feel);
    const old = saved.get(id);
    if (old && old.version === FEEL_VERSION && old.constant === chart.internal && old.hash === hash) return; // the same as saved (even when forced)
    writes.push({
      replaceOne: {
        filter: { _id: id },
        replacement: { _id: id, songId: song.id, chart: chartId(chart), constant: chart.internal, version: FEEL_VERSION, hash, feel, updatedAt: new Date() },
        upsert: true,
      },
    });
  });
  const checked = charts.length;

  // written in small batches, one a second: the free Atlas tier allows 100 operations a second
  // for everything (the site's own reads too) and slows the whole cluster down past that. a
  // run that rewrites every chart (after FEEL_VERSION goes up) takes about 2 minutes this way,
  // longer than the nightly job may run on Vercel, so run that one by hand (/api/chart-feel/refresh)
  const feels = db.collection<FeelDoc>(COLLECTION);
  for (let i = 0; i < writes.length; i += WRITES_PER_SECOND) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    await feels.bulkWrite(writes.slice(i, i + WRITES_PER_SECOND), { ordered: false });
  }
  await db.collection('metadata').updateOne({ _id: META_ID } as object, { $set: { levels, lastRun: new Date(), maishiftStamp } }, { upsert: true });

  return { players: players.length, levelsChanged: changed.size, chartsChecked: checked, chartsUpdated: writes.length, fromMaishift, ms: Date.now() - started };
}
