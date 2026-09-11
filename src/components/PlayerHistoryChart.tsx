'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { RankHistoryEntry } from '../lib/leaderboard';

type Metric = 'rating' | 'rank';

interface ChartPoint {
  label: string;
  fullDate: string;
  rating: number;
  rank: number;
}

const ACCENT = '#2563eb'; // same blue as the faq highlight
const TZ = 'Pacific/Honolulu'; // fixed tz so server and client render the same dates

const css = `
  .chart-card {
    border: 1px solid var(--border-light);
    border-radius: 8px;
    padding: 1rem 1rem 0.75rem 1rem;
  }
  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .chart-title {
    font-size: 1.2rem;
    margin: 0;
  }
  .chart-toggle {
    display: inline-flex;
    border: 1px solid var(--border-light);
    border-radius: 6px;
    padding: 2px;
  }
  .chart-toggle button {
    border: 0;
    background: transparent;
    color: var(--text-sub);
    font: inherit;
    font-size: 0.8rem;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
  }
  .chart-toggle button:focus-visible {
    outline: 2px solid ${ACCENT};
    outline-offset: 1px;
  }
  .chart-toggle button.active {
    background: ${ACCENT};
    color: #fff;
  }
  .chart-wrap {
    height: 260px;
    width: 100%;
  }
  .chart-empty {
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .chart-tooltip {
    background: var(--tooltip-bg);
    color: var(--tooltip-text);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.8rem;
    box-shadow: 0px 4px 12px rgba(0,0,0,0.25);
    min-width: 120px;
  }
  .chart-tooltip-date {
    font-size: 0.75rem;
    color: var(--text-muted);
    border-bottom: 1px solid var(--tooltip-border);
    padding-bottom: 2px;
    margin-bottom: 4px;
  }
  .chart-tooltip-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 1px 0;
  }
  .chart-tooltip-row.dim {
    opacity: 0.6;
  }

  @media (max-width: 600px) {
    .chart-card {
      padding: 0.75rem 0.5rem 0.5rem 0.5rem;
    }
    .chart-header {
      padding: 0 0.25rem;
      margin-bottom: 0.75rem;
    }
    .chart-title {
      font-size: 1rem;
    }
    .chart-wrap {
      height: 200px;
    }
  }
`;

function ChartTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: { payload?: ChartPoint }[];
  metric: Metric;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{point.fullDate}</div>
      <div className={`chart-tooltip-row ${metric === 'rating' ? '' : 'dim'}`}>
        <span>rating</span>
        <b>{point.rating}</b>
      </div>
      <div className={`chart-tooltip-row ${metric === 'rank' ? '' : 'dim'}`}>
        <span>rank</span>
        <b>#{point.rank}</b>
      </div>
    </div>
  );
}

export default function PlayerHistoryChart({ data = [] }: { data?: RankHistoryEntry[] }) {
  const [metric, setMetric] = useState<Metric>('rating');

  const chartData: ChartPoint[] = data.map((entry) => {
    const d = new Date(entry.date);
    return {
      label: d.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }),
      fullDate: d.toLocaleDateString('en-US', {
        timeZone: TZ,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      rating: entry.rating,
      rank: entry.rank,
    };
  });

  // integer bounds so the axis never lands on half-steps; rank can't go below #1
  const yDomain: [(n: number) => number, (n: number) => number] =
    metric === 'rank'
      ? [(min) => Math.max(1, Math.floor(min) - 1), (max) => Math.ceil(max) + 1]
      : [(min) => Math.floor(min) - 10, (max) => Math.ceil(max) + 10];

  const showDots = chartData.length <= 30;

  return (
    <div className="chart-card">
      <style>{css}</style>

      <div className="chart-header">
        <h2 className="chart-title">history</h2>
        <div className="chart-toggle">
          {(['rating', 'rank'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              className={metric === m ? 'active' : ''}
              onClick={() => setMetric(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="chart-empty">no history yet. check back after the next midnight update</div>
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-light)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--text-sub)', fontSize: 11 }}
                tickMargin={8}
                minTickGap={24}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--text-sub)', fontSize: 11 }}
                width={metric === 'rating' ? 44 : 32}
                allowDecimals={false}
                reversed={metric === 'rank'}
                domain={yDomain}
                tickFormatter={(v) => (metric === 'rank' ? `#${v}` : `${v}`)}
              />
              <Tooltip
                content={<ChartTooltip metric={metric} />}
                cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke={ACCENT}
                strokeWidth={2}
                dot={showDots ? { r: 2.5, fill: ACCENT, strokeWidth: 0 } : false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}