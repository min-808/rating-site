import Link from 'next/link';
import type { Metadata } from 'next';
import { connectMongo } from '../../../../lib/connect-db';
import { toNormalWidth, type PlayerDocument, type SongMetaDocument } from '../../../../lib/leaderboard';
import { VERSION_NAMES, versionName } from '../../../../lib/versions';
import { rankImage, badgeImageFor } from '../../../../lib/badges';
import LevelTiles, { type TileLevel } from '../../../../components/LevelTiles';
import { getSongLevels, getSongMeta } from '../../../../lib/song-data';
import { getPlayerByWebId } from '../../../../lib/player-data';
import RegionRadios from '../../../../components/RegionRadios';
import FilterBy from '../../../../components/FilterBy';
import { CHART_DIFFICULTIES } from '../../../../lib/difficulties';
import QuietSelect from '../../../../components/QuietSelect';
import { isGf } from '../../../../lib/special-players';
import { mergeJpScores } from '../../../../lib/jp-scores';
import {
  type SongDoc, type SummaryFilters, type RowSort, allCharts, filterCharts, summarize, groupByConstant, groupRows, ROW_ORDERS,
  levelValue, levelLabel, FIRST_DECIMAL_LEVEL, GRADES, gradesFor, naExcluded, mostPlayedLevel,
  SUMMARY_RANKS, SUMMARY_COMBOS, SUMMARY_SYNCS, VERSION_BASES,
} from '../../../../lib/level-summary';

/**
 * /user/[id]/levels: the level summary. Pick a level the way the game shows them ("14" is
 * 14.0 to 14.5, "14+" is 14.6 to 14.9), or tick "range" for a range of internal levels
 * (13.0 to 15.0, at most MAX_RANGE apart, so it doesn't load too many jackets),
 * optionally a range of versions, and whether to include charts they haven't played,
 * and it lists every chart in it, grouped by constant, with how they did on each and a
 * summary on top (lib/level-summary.ts).
 *
 * The filters are a plain form that puts them in the address
 *   ?level=14+                  one level (14.6 to 14.9)
 *   ?range=1&min=13.0&max=15.0  a range
 *   ?by=difficulty&diff=expert&diff=master   every expert and master chart, any level
 *   ...&grade=below-SSS%2B                  only charts below SSS+ (or grade=SS-up: SS or better)
 *   ...&region=intl                         every chart (default: NA, without the songs it doesn't have)
 *   ...&unplayed=1&from=25000&to=26500&sort=combo
 * Charts are grouped by constant (14.5, 14.4...), and within each constant, split into rows
 * by grade (SSS+, SSS...: the default), combo (AP+, AP, FC+, FC), sync (FDX+ ... SYNC) or
 * AP (AP+, AP, the rest), with unplayed charts in a last row. Clicking a played chart opens
 * the same popup as the best 50 (components/LevelTiles.tsx).
 * so a view can be bookmarked or shared, and the page does the filtering on the server
 * (the whole song list never goes to the browser).
 */

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    level?: string; range?: string; min?: string; max?: string; unplayed?: string; from?: string; to?: string; sort?: string;
    by?: string; diff?: string | string[]; grade?: string; region?: string;
  }>;
};

export const dynamic = 'force-dynamic';

const DEFAULT_LEVEL = '13';
// the widest range: 13.0 to 15.0. wider ones load hundreds of jackets at once
const MAX_RANGE = 2.0;

// cached on the server for a few minutes (lib/player-data.ts)
async function getPlayer(id: string) {
  const webId = parseInt(id, 10);
  if (Number.isNaN(webId)) return null;
  return getPlayerByWebId(webId);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const player = await getPlayer((await params).id);
  return { title: player ? `${toNormalWidth(player.name)}'s level summary - HI Maimai` : 'Level summary - HI Maimai' };
}

// a level from the address: a number from 1 to 15, to one decimal, or the default
function parseLevel(raw: string | undefined, fallback: number) {
  const n = parseFloat(raw ?? '');
  return Number.isFinite(n) ? Math.round(Math.min(15, Math.max(1, n)) * 10) / 10 : fallback;
}
/**
 * A level as the game shows it, to the internal levels it covers: "14" is 14.0 to 14.5,
 * "14+" is 14.6 to 14.9 (how maimai splits them now). Below 7 levels are whole numbers,
 * with no "+": "6" is just 6. Whole levels only: anything else (decimals included, those
 * are for the range boxes) is null
 */
function levelSpan(raw: string): [number, number] | null {
  const m = raw.trim().match(/^(\d{1,2})(\+)?$/);
  if (!m) return null;
  const whole = Number(m[1]);
  if (whole < 1 || whole > 15) return null;
  if (whole < FIRST_DECIMAL_LEVEL) return m[2] ? null : [whole, whole];
  return m[2] ? [whole + 0.6, whole + 0.9] : [whole, whole + 0.5];
}

// a range box's level: below 7 there are only whole levels, so 6.4 is 6
const snapLevel = (n: number) => (n < FIRST_DECIMAL_LEVEL ? Math.floor(n) : n);

const parseVersion = (raw: string | undefined) => {
  const n = Number(raw);
  return VERSION_BASES.includes(n) ? n : null;
};

const DIFF_COLOR: Record<string, string> = {
  basic: '#22a352', advanced: '#d99000', expert: '#e0403a', master: '#9b4fd1', remaster: '#b48be0',
};
const DIFF_LABEL: Record<string, string> = {
  basic: 'Basic', advanced: 'Advanced', expert: 'Expert', master: 'Master', remaster: 'Re:Master',
};

const css = `
  .ls-wrap { max-width: 1000px; margin: 0 auto; padding: 0 2rem 2rem; font-family: sans-serif; }
  .ls-back { display: inline-block; margin-bottom: 1rem; font-size: 0.85rem; color: var(--text-sub); text-decoration: none; }
  .ls-back:hover { color: #2563eb; }
  .ls-wrap h1 { margin: 0 0 1rem; font-size: 1.8rem; }
  .ls-box { margin: 0 0 1.25rem; padding: 1rem 1.25rem; border: 1px solid var(--border-light); border-radius: 12px; }

  /* the filters */
  .ls-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.9rem 1.5rem; }
  .ls-field { display: flex; flex-direction: column; gap: 4px; }
  .ls-field > span { font-size: 0.75rem; font-weight: 700; color: var(--text-sub); }
  .ls-pair { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-sub); }
  .ls-form input[type="number"], .ls-form select { font: inherit; font-size: 0.9rem; padding: 6px 8px; border-radius: 7px;
    border: 1px solid var(--border-light); background: transparent; color: inherit; }
  .ls-form input[type="number"] { width: 5rem; }
  .ls-form select option { color: initial; }
  /* a checkbox on its own in the filter row ("include unplayed") sits level with the middle
     of the dropdowns next to it: the row lines things up along their bottom edge, and a
     dropdown is taller than a line of text */
  .ls-check { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; padding-bottom: 9px; cursor: pointer; }
  .ls-check-inline { padding-bottom: 0; margin-left: 4px; }
  /* the same for the na / international radios, which have no label above them either */
  .ls-region { padding-bottom: 9px; }
  .ls-note { font-size: 0.72rem; color: var(--text-muted); }
  .ls-form input.ls-level { width: 4rem; font: inherit; font-size: 0.9rem; padding: 6px 8px; border-radius: 7px;
    border: 1px solid var(--border-light); background: transparent; color: inherit; }
  .ls-form input:invalid { border-color: #e11d48; }
  .ls-capped { flex-basis: 100%; color: #e11d48; }
  /* level or difficulty: the radios on top, both filters under them, the unused one greyed out */
  .ls-filterby { display: flex; flex-direction: column; gap: 8px; }
  .ls-modes { display: flex; gap: 14px; }
  .ls-off { opacity: 0.4; }
  .ls-diffs { display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .ls-diff { color: var(--diff); font-weight: 700; }
  .ls-btn { border: 0; border-radius: 8px; padding: 8px 18px; font: inherit; font-weight: 700; cursor: pointer;
    background: #2563eb; color: #fff; margin-left: auto; }
  .ls-btn:hover { background: #1d4ed8; }
  .ls-form input:focus-visible, .ls-form select:focus-visible, .ls-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

  /* the summary */
  .ls-stats { display: flex; flex-wrap: wrap; gap: 0.75rem 2rem; }
  .ls-stat { display: flex; flex-direction: column; gap: 2px; }
  .ls-stat b { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
  .ls-stat span { font-size: 0.75rem; color: var(--text-sub); }
  /* the game-style counts: an image (or name) over "n/total", in rows */
  .ls-counts { display: flex; flex-wrap: wrap; gap: 0.75rem 1.1rem; margin-top: 0.9rem; padding-top: 0.9rem;
    border-top: 1px solid var(--border-light); }
  .ls-count { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 52px;
    font-size: 0.8rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .ls-count img { height: 24px; }
  .ls-count-text { height: 24px; display: flex; align-items: center; font-size: 0.72rem; font-weight: 800;
    letter-spacing: 0.04em; color: var(--text-sub); }
  .ls-count span.ls-complete { color: #fff176; text-shadow: 0 0 6px rgba(255, 230, 80, 0.35); }
  :root[data-theme="light"] .ls-count span.ls-complete { color: #ca8a04; text-shadow: none; }
  .ls-empty { margin: 0; color: var(--text-sub); font-size: 0.9rem; }

  /* the charts, one row of tiles per constant */
  .ls-group { margin: 0 0 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-light); }
  .ls-group-head { display: flex; align-items: baseline; gap: 0.75rem; margin: 0 0 0.5rem; }
  .ls-group-head h2 { margin: 0; font-size: 2rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .ls-group-head span { font-size: 0.8rem; color: var(--text-sub); }
  /* every chart at this constant played: its "played / total" in yellow */
  /* (and the summary's "charts played", when every chart in the range is) */
  .ls-group-head span.ls-complete, .ls-stat b.ls-complete { color: #fff176; font-weight: 700; text-shadow: 0 0 6px rgba(255, 230, 80, 0.35); }
  :root[data-theme="light"] .ls-group-head span.ls-complete, :root[data-theme="light"] .ls-stat b.ls-complete { color: #ca8a04; text-shadow: none; }
  .ls-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 6px; list-style: none; margin: 0; padding: 0; }
  .ls-tile { position: relative; aspect-ratio: 1; border-radius: 7px; overflow: hidden; border: 2px solid var(--diff);
    background: rgba(127,127,127,0.15); }
  .ls-tile img.ls-art { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ls-noart { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 4px;
    font-size: 0.6rem; text-align: center; overflow: hidden; color: var(--text-sub); }
  .ls-unplayed { opacity: 0.35; filter: grayscale(1); }
  .ls-combo { position: absolute; top: 1px; left: 1px; height: 28px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7)); }
  .ls-dx { position: absolute; top: 2px; right: 2px; font-size: 0.55rem; font-weight: 800; padding: 0 3px; border-radius: 3px;
    background: rgba(0,0,0,0.6); color: #fff; }
  /* the same dark fade as the best 50's cards, so the score reads over any jacket */
  .ls-foot { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center;
    padding: 12px 2px 3px; color: #fff;
    background: linear-gradient(to top,
      rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 15%, rgba(0,0,0,0.70) 30%,
      rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.2) 95%, rgba(0,0,0,0) 100%); }
  .ls-foot img { height: 22px; }
  /* inside a level, a row per grade: its rank image on the left, the tiles beside it */
  .ls-grade-row { display: grid; grid-template-columns: 52px 1fr; align-items: start; gap: 8px; margin: 0 0 6px; }
  .ls-grade-label { display: flex; align-items: center; justify-content: center; min-height: 40px; padding-top: 4px; }
  .ls-grade-label img { width: 100%; max-width: 52px; }
  .ls-grade-label img.ls-badge-label { width: auto; height: 34px; }
  .ls-grade-label span { font-size: 0.65rem; font-weight: 700; color: var(--text-sub); text-align: center; line-height: 1.2; }
  .ls-foot span { font-size: 0.78rem; font-weight: 800; font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
  /* a played tile is a button over the whole thing, opening the score popup */
  .ls-open { position: absolute; inset: 0; z-index: 2; border: 0; padding: 0; background: transparent; cursor: pointer; border-radius: 5px; }
  .ls-open:hover { background: rgba(255,255,255,0.08); }
  .ls-open:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
  .ls-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

  @media (max-width: 600px) {
    .ls-wrap { padding: 0 1rem 1.5rem; }
    .ls-box { padding: 0.75rem; }
    .ls-btn { margin-left: 0; }
    /* each filter on its own line, the version dropdowns sharing it instead of overflowing */
    .ls-field { width: 100%; }
    .ls-pair select { flex: 1; min-width: 0; }
    .ls-tiles { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); }
  }
`;

// one of the summary's counts: its rank or badge image (or name), and "n/total", in the
// fully-played yellow when it's all of them
function SummaryCount({ label, image, n, total }: { label: string; image: string | null; n: number; total: number }) {
  return (
    <div className="ls-count" title={`${label} or better: ${n} of ${total}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image ? <img src={image} alt={label} /> : <span className="ls-count-text">{label}</span>}
      <span className={n >= total && total > 0 ? 'ls-complete' : undefined}>{n}/{total}</span>
    </div>
  );
}

export default async function LevelSummaryPage({ params, searchParams }: Props) {
  const { id } = await params;
  const q = await searchParams;
  const player = await getPlayer(id);

  if (!player) {
    return (
      <main className="ls-wrap">
        <style>{css}</style>
        <Link href="/" className="ls-back">← back to leaderboard</Link>
        <h1>player not found</h1>
      </main>
    );
  }

  const name = toNormalWidth(player.name);
  const backToProfile = <Link href={`/user/${player.web_id}`} className="ls-back">← back to {name}&apos;s profile</Link>;

  if (player.scores_opt_out) {
    return (
      <main className="ls-wrap">
        <style>{css}</style>
        {backToProfile}
        <h1>level summary</h1>
        <p className="ls-empty">{name}&apos;s scores are hidden</p>
      </main>
    );
  }

  // their scores: with her japanese ones too, when she has them switched on (same as the profile)
  // connectMongo, not getMongoClient: the player can come from the cache (lib/player-data.ts),
  // so nothing may have opened the connection yet on this server
  const client = await connectMongo();
  const db = client.db('maimai');
  const account = isGf(player.user_id)
    ? await db.collection<{ _id: string; show_jp_scores?: boolean }>('accounts').findOne({ _id: String(player.user_id) }, { projection: { show_jp_scores: 1 } })
    : null;
  const showJp = isGf(player.user_id) && account?.show_jp_scores !== false && (player.jp_songs?.length ?? 0) > 0;
  const scores = showJp ? mergeJpScores(player.songs, player.jp_songs) : (player.songs ?? []);

  // the filters, from the address
  // one level ("14", "14+"), or a range ("range" ticked, or an old link with just min and max).
  // no level asked for: the one they've played the most charts at
  const isRange = q.range === '1' || (q.level == null && q.min != null && q.max != null);
  const levelText = (q.level ?? '').trim() && levelSpan(q.level!)
    ? q.level!.trim()
    : mostPlayedLevel(scores) ?? DEFAULT_LEVEL;
  const [levelLow, levelHigh] = levelSpan(levelText)!;
  let min = isRange ? parseLevel(q.min, levelLow) : levelLow;
  let max = isRange ? parseLevel(q.max, min + 1) : levelHigh;
  min = snapLevel(min);
  max = snapLevel(max);
  // the second box below the first: just the first
  if (max < min) max = min;
  // too wide: the first MAX_RANGE levels of it, and say so
  const capped = isRange && max - min > MAX_RANGE + 1e-9;
  if (capped) max = Math.round((min + MAX_RANGE) * 10) / 10;
  let versionFrom = parseVersion(q.from);
  let versionTo = parseVersion(q.to);
  if (versionFrom != null && versionTo != null && versionFrom > versionTo) [versionFrom, versionTo] = [versionTo, versionFrom];
  // by difficulty instead: every level, just the ticked difficulties
  const byDifficulty = q.by === 'difficulty';
  const difficulties = [q.diff ?? []].flat().filter((d) => (CHART_DIFFICULTIES as readonly string[]).includes(d));
  // "below SSS+" / "SS or better" (nothing picked: any grade)
  const gradeChoice = gradesFor(q.grade) ? q.grade! : '';
  const grades = gradesFor(gradeChoice);
  const filters: SummaryFilters = byDifficulty
    ? { min: 1, max: 15, includeUnplayed: q.unplayed === '1', versionFrom, versionTo, difficulties, grades }
    : { min, max, includeUnplayed: q.unplayed === '1', versionFrom, versionTo, grades };

  // the game's song data, cached on the server (lib/song-data.ts), not read on every view
  const [songDocs, metaDocs] = await Promise.all([getSongLevels(), getSongMeta()]);
  // NA (the default): without the songs North America doesn't have, like the profile's level breakdown
  const region = q.region === 'intl' ? 'intl' : 'na';
  if (region === 'na') filters.excludedTitles = naExcluded(songDocs);
  const everyChart = allCharts(songDocs, scores);
  const charts = filterCharts(everyChart, filters);
  // how many charts each constant really has (in these versions), and how many of those
  // they've played, whatever's being shown: unplayed charts hidden, or only some grades.
  // so "played / total" and "every chart played" are always the real numbers
  const totalAt = new Map<string, number>();
  const playedAt = new Map<string, number>();
  const rangeCharts = filterCharts(everyChart, { ...filters, includeUnplayed: true, grades: null });
  for (const c of rangeCharts) {
    const k = levelLabel(levelValue(c));
    totalAt.set(k, (totalAt.get(k) ?? 0) + 1);
    if (c.played) playedAt.set(k, (playedAt.get(k) ?? 0) + 1);
  }
  // the summary counts like the game's own level pages: every chart in the range, whatever's
  // being shown, each grade and badge "or better"
  const summary = summarize(rangeCharts);

  // by constant, highest first, and within each a row per grade, combo or sync
  const sort: RowSort = q.sort && q.sort in ROW_ORDERS ? (q.sort as RowSort) : 'grade';
  // a row's label image: its rank, or its combo / sync badge. none for "unplayed" and the like
  const rowImage = (row: string) => (sort === 'grade' ? ((ROW_ORDERS.grade as readonly string[]).slice(0, 9).includes(row) ? rankImage(row) : null) : badgeImageFor(row));

  // jackets and details (for the popup). songmeta is keyed by the title as people's scores
  // spell it, which isn't always the songs collection's spelling (full-width spaces, say),
  // so: the exact title first, then the same title spelled loosely ("TRUST" and "Trust" are
  // different songs, so the exact match has to win)
  const looseTitle = (t: string) => toNormalWidth(String(t ?? '')).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const metaExact = new Map(metaDocs.map((m) => [m._id, m]));
  const metaLoose = new Map(metaDocs.map((m) => [looseTitle(m._id), m]));
  const metaFor = (title: string) => metaExact.get(title) ?? metaLoose.get(looseTitle(title));
  // a jacket: by genre for the songs that share a title (the "Link"s), else the title's.
  // genres are matched loosely too: the song list and maimai NET spell some differently
  const jacketFor = (title: string, genre: string | null | undefined) => {
    const m = metaFor(title);
    if (!m) return null;
    const byGenre = m.by_genre ?? {};
    const wanted = genre ? looseTitle(genre) : null;
    const match = wanted ? Object.entries(byGenre).find(([g]) => looseTitle(g) === wanted)?.[1] : null;
    return match?.blob ?? m.blob ?? Object.values(byGenre).find((g) => g.blob)?.blob ?? null;
  };
  // a score as the popup wants it: jacket, version and details filled in, dates as text
  const forPopup = (s: (typeof scores)[number]) => {
    const m = metaFor(s.title);
    return {
      ...s,
      jacket_blob: jacketFor(s.title, s.genre) ?? s.jacket_blob,
      artist: m?.artist ?? s.artist,
      bpm: m?.bpm ?? s.bpm,
      version: versionName(m?.version_code ?? s.version_code),
      improved_at: s.improved_at ? new Date(s.improved_at).toISOString() : null,
    };
  };

  // an unplayed chart for the popup: its details, and no score (achievement null)
  const unplayedInfo = (c: (typeof charts)[number]) => {
    const m = metaFor(c.title);
    return {
      title: c.title, kind: c.kind, difficulty: c.difficulty, level: c.level ?? '', genre: '',
      internal_difficulty: c.internal, achievement: null as unknown as number, rating: 0,
      new_pool: false, ap: false,
      jacket_blob: jacketFor(c.title, c.genre) ?? undefined, artist: m?.artist, bpm: m?.bpm,
      version: versionName(m?.version_code ?? c.versionCode),
    };
  };

  const levels: TileLevel[] = groupByConstant(charts).map((g) => ({
    constant: g.constant,
    played: playedAt.get(g.constant) ?? 0,
    total: totalAt.get(g.constant) ?? g.charts.length,
    rows: groupRows(g.charts, sort).map((r) => ({
      row: r.row,
      image: rowImage(r.row),
      badge: sort !== 'grade',
      charts: r.charts.map((c) => ({
        key: c.key,
        title: c.title,
        kind: c.kind,
        difficulty: c.difficulty,
        internal: c.internal,
        jacket: jacketFor(c.title, c.genre) ?? c.played?.jacket ?? null,
        song: c.played ? forPopup(c.played) : null,
        info: c.played ? forPopup(c.played) : unplayedInfo(c),
      })),
    })),
  }));
  // every score they have, for the popup's "new PB: +N" (what it added to their best 50)
  const allScores = scores.map((s) => ({ ...s, improved_at: s.improved_at ? new Date(s.improved_at).toISOString() : null }));

  // the grade filter: any, below each grade (SSS+ down to A), each grade or better (SSS+,
  // which is just SSS+, down to A)
  const gradeChoices = [
    { value: '', label: 'any' },
    ...GRADES.slice(0, -1).map((g) => ({ value: `below-${g}`, label: `below ${g}`, group: 'below' })),
    ...GRADES.slice(0, -1).map((g, i) => ({ value: `${g}-up`, label: i === 0 ? `${g} only` : `${g} or better`, group: 'or better' })),
  ];

  // "all" (sent as nothing), then every version
  const versionChoices = [
    { value: '', label: 'all' },
    ...VERSION_BASES.map((code) => ({ value: String(code), label: VERSION_NAMES[String(code)] })),
  ];

  return (
    <main className="ls-wrap">
      <style>{css}</style>
      {backToProfile}
      <h1>{name}&apos;s level summary</h1>

      <form className="ls-box ls-form" method="get" action={`/user/${player.web_id}/levels`}>
        <FilterBy byDifficulty={byDifficulty} difficulties={difficulties}
          level={levelText} isRange={isRange} min={min} max={max} maxRange={MAX_RANGE} />
        {capped && !byDifficulty && <span className="ls-note ls-capped">ranges go up to {MAX_RANGE.toFixed(0)} levels, so this shows {min.toFixed(1)} to {max.toFixed(1)}</span>}
        <label className="ls-field">
          <span>versions</span>
          <span className="ls-pair">
            <QuietSelect name="from" defaultValue={String(versionFrom ?? '')} options={versionChoices} ariaLabel="oldest version" />
            to
            <QuietSelect name="to" defaultValue={String(versionTo ?? '')} options={versionChoices} ariaLabel="newest version" />
          </span>
        </label>
        <label className="ls-field">
          <span>sort each level by</span>
          <QuietSelect name="sort" defaultValue={sort} quietValue="grade" ariaLabel="sort each level by" options={[
            { value: 'grade', label: 'grade' },
            { value: 'ap', label: 'ap/ap+' },
            { value: 'combo', label: 'combo' },
            { value: 'sync', label: 'sync' },
          ]} />
        </label>
        {/* "any" stays out of the address */}
        <label className="ls-field">
          <span>grades</span>
          <QuietSelect name="grade" defaultValue={gradeChoice} ariaLabel="grades" options={gradeChoices} />
        </label>
        <RegionRadios region={region} />
        <label className="ls-check">
          <input type="checkbox" name="unplayed" value="1" defaultChecked={filters.includeUnplayed} />
          include unplayed
        </label>
        <button type="submit" className="ls-btn">show</button>
      </form>

      <section className="ls-box" aria-label="summary">
        {summary.total === 0 ? (
          <p className="ls-empty">no charts match these filters</p>
        ) : (
          <>
            <div className="ls-stats">
              {/* every chart in the range played: the same yellow as a fully played level */}
              <div className="ls-stat">
                <b className={summary.played >= summary.total ? 'ls-complete' : undefined}>{summary.played} / {summary.total}</b>
                <span>charts played</span>
              </div>
              <div className="ls-stat"><b>{summary.average == null ? '-' : `${summary.average.toFixed(4)}%`}</b><span>average accuracy</span></div>
            </div>
            {/* like the game's level pages: each is that grade or badge or better, out of every chart */}
            <div className="ls-counts">
              <SummaryCount label="CLEAR" image={null} n={summary.clear} total={summary.total} />
              {SUMMARY_RANKS.map((r) => <SummaryCount key={r.label} label={r.label} image={rankImage(r.label)} n={summary.ranks[r.label]} total={summary.total} />)}
            </div>
            <div className="ls-counts">
              {SUMMARY_COMBOS.map((c) => <SummaryCount key={c.label} label={c.label} image={badgeImageFor(c.label)} n={summary.combos[c.label]} total={summary.total} />)}
              {SUMMARY_SYNCS.map((x) => <SummaryCount key={x.label} label={x.label} image={badgeImageFor(x.label)} n={summary.syncs[x.label]} total={summary.total} />)}
            </div>
          </>
        )}
      </section>

      <LevelTiles levels={levels} showRank={sort !== 'grade'} allScores={allScores} />
    </main>
  );
}
