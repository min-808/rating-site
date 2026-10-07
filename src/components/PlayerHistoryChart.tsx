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
 * Both graphs (rating and rank) are drawn in the color of the player's current
 * rating badge: blue, green, ... gold, platinum, and a rainbow from 15000 up.
 */

type Metric = 'rating' | 'rank';

interface ChartPoint {
  ts: number;
  fullDate: string;
  rating: number;
  rank: number;
}

const TZ = 'Pacific/Honolulu';

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
  rating?: number; // their current rating, which picks the color. defaults to the latest point
}) {
  const [metric, setMetric] = useState<Metric>('rating');
  const id = useId().replace(/:/g, '');
  const lineId = `hc-line-${id}`;
  const fillId = `hc-fill-${id}`;

  const tier = ratingColor(rating ?? data[data.length - 1]?.rating);
  const { colors } = tier;
  const color = colors[0];
  const multi = colors.length > 1;
  // spread the colors evenly along the line, left to right
  const stops = colors.map((c, i) => ({ c, at: colors.length === 1 ? 0 : (i / (colors.length - 1)) * 100 }));

  const points: ChartPoint[] = data.map((entry) => {
    const d = new Date(entry.date);
    return {
      ts: d.getTime(),
      fullDate: d.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' }),
      rating: entry.rating,
      rank: entry.rank,
    };
  });

  // a little headroom above and below so the line never touches the edges.
  // rank is flipped, so going up the list draws the line going up
  const values = points.map((p) => p[metric]);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.12, metric === 'rating' ? 5 : 1);
  const domain: [number, number] = [Math.max(metric === 'rank' ? 1 : 0, lo - pad), hi + pad];

  // the fill always hangs below the line. rank's axis is flipped (#1 at the top),
  // so its "bottom" is the bigger number
  const baseValue = metric === 'rank' ? domain[1] : domain[0];

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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 28, right: 4, left: 4, bottom: 4 }}>
                <defs>
                  {/* the line: one color, or the rainbow running left to right */}
                  {/* measured across the whole chart, not the line's own box: a perfectly
                      flat line has no height, and a box-based gradient wouldn't paint on it */}
                  <linearGradient id={lineId} gradientUnits="userSpaceOnUse" x1="0%" y1="0" x2="100%" y2="0">
                    {stops.map(({ c, at }) => <stop key={at} offset={`${at}%`} stopColor={c} />)}
                  </linearGradient>
                  {/* the fade under it. one color fades downward; a rainbow can't fade
                      both ways in one gradient, so it's a soft band of the same colors */}
                  {multi ? (
                    <linearGradient id={fillId} gradientUnits="userSpaceOnUse" x1="0%" y1="0" x2="100%" y2="0">
                      {stops.map(({ c, at }) => <stop key={at} offset={`${at}%`} stopColor={c} stopOpacity={0.16} />)}
                    </linearGradient>
                  ) : (
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  )}
                </defs>
                <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} hide />
                <YAxis hide domain={domain} reversed={metric === 'rank'} allowDecimals={false} />
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
                  activeDot={{ r: 4.5, fill: color, stroke: 'var(--background, #fff)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="hc-ends" aria-hidden="true">
            <span>{shortDate(points[0].ts)}</span>
            {points.length > 1 && <span>{shortDate(points[points.length - 1].ts)}</span>}
          </div>
        </>
      )}
    </div>
  );
}