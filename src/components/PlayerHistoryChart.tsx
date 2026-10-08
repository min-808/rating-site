'use client';

import { useId, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import type { RankHistoryEntry } from '../lib/leaderboard';
import { ratingColor } from '../lib/rating-colors';

/**
 * The rating / rank history graph inside a profile's overview card. Kept bare on
 * purpose, like an osu! profile: no box, no grid, no axes, one line with a soft
 * fade under it. Hovering shows the date and both numbers; the first and last
 * dates sit underneath so you can tell how far back it goes.
 *
 * The line is colored by the rating badge the player had at each point in time:
 * a stretch spent in bronze is bronze, then it blends into silver where they
 * crossed 13000, and so on up to the rainbows. Both graphs (rating and rank) use
 * the same colors, since the badge always comes from rating.
 */

type Metric = 'rating' | 'rank';

interface ChartPoint {
  ts: number;
  fullDate: string;
  rating: number;
  rank: number;
}

const TZ = 'Pacific/Honolulu';

// room for the axis labels on the left ("16,250", "#12"), and the chart's own margins
const AXIS_WIDTH = 40;
const MARGIN = { top: 28, right: 4, left: 0, bottom: 4 };

// every graph gets exactly this many axis labels, evenly spaced
const AXIS_LABELS = 4;

// round steps to try, smallest first: 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, ...
// (2.5 only from 25 up, so labels stay whole numbers, like ratings and ranks)
function* roundSteps() {
  for (let power = 1; ; power *= 10) {
    for (const m of power >= 10 ? [1, 2, 2.5, 5] : [1, 2, 5]) yield m * power;
  }
}

/**
 * The axis for a graph whose values run from lo to hi: exactly AXIS_LABELS round,
 * evenly spaced labels, and the range the graph shows.
 *
 * It takes the smallest round step whose labels can cover lo..hi (starting on a
 * multiple of the step or half of it), then makes the graph's range those labels
 * plus a little room, rather than the other way round.
 * So the line may not fill the box top to bottom, but every graph reads the same.
 * Ranks never go below #1, so their labels start at 1, 3, 5... rather than 0, 2, 4.
 */
function axisFor(lo: number, hi: number, metric: Metric): { ticks: number[]; domain: [number, number] } {
  // a flat line still gets a sensible spread of labels around it
  const minSpan = metric === 'rating' ? 20 : AXIS_LABELS - 1;
  if (hi - lo < minSpan) {
    const mid = (lo + hi) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
    if (metric === 'rank' && lo < 1) { hi += 1 - lo; lo = 1; }
  }

  const gaps = AXIS_LABELS - 1;
  for (const step of roundSteps()) {
    // the first label sits on a multiple of the step, or of half of it (13,500 / 14,500 / ...)
    // when that hugs the line better than starting a whole step lower
    for (const unit of step % 2 === 0 ? [step, step / 2] : [step]) {
      const first = metric === 'rank'
        ? Math.max(1, Math.floor((lo - 1) / unit) * unit + 1)
        : Math.floor(lo / unit) * unit;
      if (first + gaps * step < hi) continue;

      const ticks = Array.from({ length: AXIS_LABELS }, (_, i) => first + i * step);
      // a little room past the outer labels, so the line never sits on the edge.
      // ranks stop just short of #0
      const room = step * 0.15;
      const bottom = metric === 'rank' ? Math.max(0.5, first - room) : first - room;
      return { ticks, domain: [bottom, ticks[ticks.length - 1] + room] };
    }
  }
  throw new Error('unreachable');
}

type Stop = { at: number; color: string }; // at: 0 to 100, left to right

/**
 * Gradient stops along the line, from each point's badge color.
 *
 * Runs of points in the same badge are solid in that badge's color (a rainbow
 * spreads its colors across its own run). Between the last point of one badge
 * and the first point of the next, the gradient blends from one to the other,
 * so the change shows up right where they crossed the line.
 */
function badgeStops(points: ChartPoint[]): Stop[] {
  if (points.length === 0) return [];
  const first = points[0].ts;
  const span = points[points.length - 1].ts - first;
  const x = (ts: number) => (span > 0 ? ((ts - first) / span) * 100 : 0);

  // consecutive points that share a badge. ratingColor hands back the same object
  // for every rating in a badge, so comparing objects is comparing badges
  const runs: { colors: string[]; from: number; to: number }[] = [];
  let tier = ratingColor(points[0].rating);
  let from = points[0].ts;
  let to = from;
  for (const p of points.slice(1)) {
    const next = ratingColor(p.rating);
    if (next !== tier) {
      runs.push({ colors: tier.colors, from: x(from), to: x(to) });
      tier = next;
      from = p.ts;
    }
    to = p.ts;
  }
  runs.push({ colors: tier.colors, from: x(from), to: x(to) });

  return runs.flatMap(({ colors, from: a, to: b }) =>
    colors.length === 1
      ? [{ at: a, color: colors[0] }, { at: b, color: colors[0] }]
      : colors.map((color, i) => ({ at: a + ((b - a) * i) / (colors.length - 1), color })),
  );
}

const css = `
  .hc { position: relative; }
  .hc-toggle { position: absolute; top: -2px; right: 0; z-index: 1; display: inline-flex; gap: 2px; padding: 2px;
    border-radius: 999px; background: rgba(127,127,127,0.12); }
  .hc-toggle button { border: 0; background: transparent; color: var(--text-sub); font: inherit; font-size: 0.72rem;
    padding: 2px 10px; border-radius: 999px; cursor: pointer; }
  .hc-toggle button:hover { color: inherit; }
  .hc-toggle button.active { background: #2563eb; color: #fff; font-weight: bold; }
  .hc-toggle button:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
  .hc-wrap { height: 150px; width: 100%; }
  .hc-ends { display: flex; justify-content: space-between; margin-top: 2px; font-size: 0.7rem; color: var(--text-muted); }
  .hc-empty { height: 110px; display: flex; align-items: center; justify-content: center; text-align: center;
    font-size: 0.82rem; color: var(--text-muted); }
  .hc-tip { background: var(--tooltip-bg); color: var(--tooltip-text); padding: 6px 10px; border-radius: 6px;
    font-size: 0.78rem; box-shadow: 0 4px 12px rgba(0,0,0,0.25); min-width: 110px; }
  .hc-tip-date { font-size: 0.72rem; color: var(--text-muted); border-bottom: 1px solid var(--tooltip-border);
    padding-bottom: 2px; margin-bottom: 3px; }
  .hc-tip-row { display: flex; justify-content: space-between; gap: 1rem; }
  .hc-tip-row.dim { opacity: 0.55; }

  @media (max-width: 600px) {
    .hc-wrap { height: 115px; }
  }
`;

function ChartTooltip({ active, payload, metric }: {
  active?: boolean;
  payload?: { payload?: ChartPoint }[];
  metric: Metric;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="hc-tip">
      <div className="hc-tip-date">{point.fullDate}</div>
      <div className={`hc-tip-row${metric === 'rating' ? '' : ' dim'}`}><span>rating</span><b>{point.rating}</b></div>
      <div className={`hc-tip-row${metric === 'rank' ? '' : ' dim'}`}><span>rank</span><b>#{point.rank}</b></div>
    </div>
  );
}

export default function PlayerHistoryChart({ data = [], rating }: {
  data?: RankHistoryEntry[];
  rating?: number; // their current rating: picks the color only when there's no history to color by
}) {
  const [metric, setMetric] = useState<Metric>('rating');
  // the chart's drawn width, so the color gradient can line up with the plot area
  const [chartWidth, setChartWidth] = useState(0);
  const id = useId().replace(/:/g, '');
  const lineId = `hc-line-${id}`;
  const fillId = `hc-fill-${id}`;

  const points: ChartPoint[] = data.map((entry) => {
    const d = new Date(entry.date);
    return {
      ts: d.getTime(),
      fullDate: d.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' }),
      rating: entry.rating,
      rank: entry.rank,
    };
  });

  // the badge colors along the line. one solid color the whole way (they never
  // changed badge) keeps the fade under the line; anything else gets a soft band
  const stops = badgeStops(points);
  const colorsUsed = [...new Set(stops.map((st) => st.color))];
  const multi = colorsUsed.length > 1;
  // with no history yet, the current rating still picks the color
  const color = colorsUsed[0] ?? ratingColor(rating).colors[0];
  // a point's own badge color, for the hover dot
  const colorAt = (r: number) => ratingColor(r).colors[0];

  // the axis labels and the range they span. rank is flipped (reversed below),
  // so going up the list draws the line going up
  const values = points.map((p) => p[metric]);
  const { ticks, domain } = values.length
    ? axisFor(Math.min(...values), Math.max(...values), metric)
    : { ticks: [], domain: [0, 1] as [number, number] };

  // the fill always hangs below the line. rank's axis is flipped (#1 at the top),
  // so its "bottom" is the bigger number
  const baseValue = metric === 'rank' ? domain[1] : domain[0];

  // the gradient runs across the plot area only (right of the axis), so a badge change
  // lands at the right point on the line. before the first measure, the whole chart
  const gradientX = chartWidth
    ? { x1: MARGIN.left + AXIS_WIDTH, x2: chartWidth - MARGIN.right }
    : { x1: '0%', x2: '100%' };

  const shortDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();

  return (
    <div
      className="hc"
      style={{
        '--hc-accent': color,
      } as React.CSSProperties}
    >
      <style>{css}</style>

      <div className="hc-toggle" role="group" aria-label="graph shows">
        {(['rating', 'rank'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={metric === m} className={metric === m ? 'active' : ''}
            onClick={() => setMetric(m)}>
            {m}
          </button>
        ))}
      </div>

      {points.length === 0 ? (
        <div className="hc-empty">no history yet. check back after the next midnight update</div>
      ) : (
        <>
          <div className="hc-wrap">
            <ResponsiveContainer width="100%" height="100%" onResize={(w) => setChartWidth(w)}>
              <AreaChart data={points} margin={MARGIN}>
                <defs>
                  {/* the line: the badge colors left to right, in time order */}
                  {/* measured across the whole chart, not the line's own box: a perfectly
                      flat line has no height, and a box-based gradient wouldn't paint on it */}
                  <linearGradient id={lineId} gradientUnits="userSpaceOnUse" {...gradientX} y1="0" y2="0">
                    {stops.map(({ color: c, at }, i) => <stop key={i} offset={`${at}%`} stopColor={c} />)}
                  </linearGradient>
                  {/* the fade under it. one color fades downward; several colors can't fade
                      both ways in one gradient, so it's a soft band of the same colors */}
                  {multi ? (
                    <linearGradient id={fillId} gradientUnits="userSpaceOnUse" {...gradientX} y1="0" y2="0">
                      {stops.map(({ color: c, at }, i) => <stop key={i} offset={`${at}%`} stopColor={c} stopOpacity={0.16} />)}
                    </linearGradient>
                  ) : (
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  )}
                </defs>
                <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} hide />
                {/* a quiet axis: a few labels, no line, no tick marks */}
                <YAxis
                  domain={domain}
                  reversed={metric === 'rank'}
                  allowDecimals={false}
                  width={AXIS_WIDTH}
                  ticks={ticks}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={4}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickFormatter={(v: number) => (metric === 'rank' ? `#${v}` : v.toLocaleString('en-US'))}
                />
                <Tooltip
                  content={<ChartTooltip metric={metric} />}
                  cursor={{ stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke={multi ? `url(#${lineId})` : color}
                  baseValue={baseValue}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  fill={`url(#${fillId})`}
                  // a lone point has no line to draw, so show it as a dot
                  dot={points.length === 1 ? { r: 3.5, fill: color, strokeWidth: 0 } : false}
                  // the hover dot takes the badge color of the point it's on
                  activeDot={(props: { cx?: number; cy?: number; payload?: ChartPoint }) => (
                    <circle cx={props.cx} cy={props.cy} r={4.5} fill={props.payload ? colorAt(props.payload.rating) : color}
                      stroke="var(--background, #fff)" strokeWidth={2} />
                  )}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* the dates start where the plot does, past the axis labels */}
          <div className="hc-ends" aria-hidden="true" style={{ paddingLeft: MARGIN.left + AXIS_WIDTH }}>
            <span>{shortDate(points[0].ts)}</span>
            {points.length > 1 && <span>{shortDate(points[points.length - 1].ts)}</span>}
          </div>
        </>
      )}
    </div>
  );
}