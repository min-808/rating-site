import { connectMongo } from './connect-db';
import { getCatalog, catalogByTitle, songForScore } from './song-catalog';
import { chartId } from './song-view';
import { chartFeel, SCORE_FLOOR, type ChartFeel, type PlayerBaseline } from './plays-like';
import { playerBaseline } from './player-baselines';

/**
 * The saved "plays like" results (lib/plays-like.ts), so a song page reads one small
 * document per chart instead of working it out from everyone's scores on every view.
 *
 *   chart_feel           one document per chart: { _id: "<song id>|dx-master", feel, constant, version }
 *   metadata/chart_feel  a fingerprint of every level: tenths of constant -> [scores, sum of
 *                        accuracy, sum of the players' ratings], and when it last ran
 *
 * refreshChartFeels() reads every player's scores, fingerprints each level, and only works
 * charts out again where something changed: a new or better score, or a player's rating
 * moving, at their constant or within 0.7 of it (the levels a player's usual score and "how
 * fast scores drop" are made from). Charts that are new, or whose constant changed, are
 * worked out too, and everything is when FEEL_VERSION goes up.
 *
 * It runs after the nightly scrape (/api/update-leaderboard) and after a player's "refresh
 * my scores" finishes. In development, /api/chart-feel/refresh runs it by hand. Server only.
 */

/** Bump when the way "plays like" is worked out changes: every chart is worked out again on the next run. */
const FEEL_VERSION = 4; // 3: only half the change is kept (CHANGE_KEPT). 4: unused fields dropped
/** How far (in tenths of constant) a changed level reaches: ±0.2 for the usual score, ±0.5 ±0.2 for the drop per level. */
const REACH_TENTHS = 7;
const COLLECTION = 'chart_feel';
const META_ID = 'chart_feel';

type LevelPrint = [number, number, number]; // [scores, sum of accuracy, sum of ratings]
type ScoreDoc = { title: string; genre?: string | null; kind?: string; difficulty?: string; internal_difficulty?: number | null; achievement?: number | null };
type FeelDoc = { _id: string; songId: string; chart: string; constant: number; version: number; feel: ChartFeel; updatedAt: Date };

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

export type RefreshResult = { skipped?: string; players: number; levelsChanged: number; chartsChecked: number; chartsUpdated: number; ms: number };

/**
 * Updates the saved results where scores changed. force: work every chart out again.
 * minIntervalMs: do nothing if it last ran more recently than this (a player's refresh can
 * report "done" on every visit to the editor; this keeps it to one run).
 */
export async function refreshChartFeels({ force = false, minIntervalMs = 0 } = {}): Promise<RefreshResult> {
  const started = Date.now();
  const db = (await connectMongo()).db('maimai');
  const meta = await db.collection<{ _id: string; levels?: Record<string, LevelPrint>; lastRun?: Date }>('metadata').findOne({ _id: META_ID });
  if (!force && minIntervalMs && meta?.lastRun && started - new Date(meta.lastRun).getTime() < minIntervalMs) {
    return { skipped: 'ran recently', players: 0, levelsChanged: 0, chartsChecked: 0, chartsUpdated: 0, ms: Date.now() - started };
  }

  const [catalog, players] = await Promise.all([
    getCatalog(),
    db.collection('players').find(
      { scores_opt_out: { $ne: true }, rating: { $gt: 0 } },
      { projection: { _id: 0, web_id: 1, rating: 1, 'songs.title': 1, 'songs.genre': 1, 'songs.kind': 1, 'songs.difficulty': 1, 'songs.internal_difficulty': 1, 'songs.achievement': 1 } },
    ).toArray(),
  ]);
  const songsByTitle = catalogByTitle(catalog);

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
    (await db.collection<FeelDoc>(COLLECTION).find({}, { projection: { constant: 1, version: 1 } }).toArray())
      .map((d) => [d._id, d]),
  );

  const writes: Array<{ replaceOne: { filter: { _id: string }; replacement: FeelDoc; upsert: true } }> = [];
  let checked = 0;
  for (const song of catalog) {
    for (const chart of song.charts) {
      checked++;
      const id = chartFeelId(song.id, chart);
      const tenth = Math.round(chart.internal * 10);
      const old = saved.get(id);
      let touched = force || !old || old.version !== FEEL_VERSION || old.constant !== chart.internal;
      for (let t = tenth - REACH_TENTHS; !touched && t <= tenth + REACH_TENTHS; t++) touched = changed.has(t);
      if (!touched) continue;
      writes.push({
        replaceOne: {
          filter: { _id: id },
          replacement: {
            _id: id, songId: song.id, chart: chartId(chart), constant: chart.internal, version: FEEL_VERSION,
            feel: chartFeel(chart.internal, chartScores.get(id) ?? [], baselines), updatedAt: new Date(),
          },
          upsert: true,
        },
      });
    }
  }

  const feels = db.collection<FeelDoc>(COLLECTION);
  for (let i = 0; i < writes.length; i += 500) await feels.bulkWrite(writes.slice(i, i + 500), { ordered: false });
  await db.collection('metadata').updateOne({ _id: META_ID } as object, { $set: { levels, lastRun: new Date() } }, { upsert: true });

  return { players: players.length, levelsChanged: changed.size, chartsChecked: checked, chartsUpdated: writes.length, ms: Date.now() - started };
}
