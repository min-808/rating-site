import type { WorkedExampleData } from '../lib/plays-like-worked';
import { LOG_OFFSET } from '../lib/maishift-feel';

/**
 * Step 5's picture on the "how plays like works" page: every comparison chart in one rating bucket
 * as a dot (its constant across, its log gap up, drawn with better scores at the top and labelled
 * in the scores they stand for), the fitted typical line, and where the example chart sits against
 * it. Drawn from a worked example's graph (lib/plays-like-worked.ts). Labels sit in the corners the
 * curve leaves empty. No hooks: renders on the server.
 */
const scoreOf = (l: number) => 101 + LOG_OFFSET - Math.exp(l);
const logOf = (m: number) => Math.log(101 - m + LOG_OFFSET);
const TICKS = [101, 100.75, 100.5, 100.25, 100, 99.5, 99, 98, 97, 96, 95, 94, 92, 90];

export default function PlaysLikeFitGraph({ example }: { example: WorkedExampleData }) {
  const { graph, constant, title, featured } = example;
  const { target, points } = graph;
  const fit = { a: graph.a, S: graph.S, q: graph.q };
  const band = example.bands.find((b) => b.from === featured)!;
  const left = 64, right = 740, y0 = 70, bottom = 380;
  // the axis: log gap, best (smallest) at the top, from the best few charts to the worst 2%
  const sorted = points.map((p) => p[1]).sort((a, b) => a - b);
  const top = Math.min(sorted[0], target, fit.a) - 0.1;
  const low = Math.max(sorted[Math.floor(sorted.length * 0.98)], target, fit.a) + 0.15;
  const xs = (d: number) => left + ((d + 0.55) / 1.1) * (right - left);
  const ys = (l: number) => y0 + ((Math.max(top, Math.min(low, l)) - top) / (low - top)) * (bottom - y0);
  const curveAt = (d: number) => fit.a + fit.S * d - fit.q * d * d;
  const path = Array.from({ length: 23 }, (_, i) => -0.55 + i * 0.05)
    .map((d, i) => `${i ? 'L' : 'M'}${xs(d).toFixed(1)},${ys(curveAt(d)).toFixed(1)}`).join(' ');
  const gap = fit.a - target; // + : better than typical
  const ticks = TICKS.filter((m) => logOf(m) >= top && logOf(m) <= low);
  const topY = bottom - 40; // the empty bottom-left corner
  const words = `${title} sits ${Math.abs(gap).toFixed(3)} ${gap >= 0 ? 'better' : 'worse'} than the typical line at ${constant}`;
  return (
    <figure className="pl-graph">
      <svg viewBox="0 0 760 430" role="img" aria-label={`step 5: ${words}`}>
        <text x={left} y="24" className="pl-graph-title">{words}</text>
        <text x={left} y="44" className="pl-graph-sub">bucket {band.from.toLocaleString('en-US')}–{band.to.toLocaleString('en-US')} · {points.length} charts from {example.era}, constants {(constant - 0.5).toFixed(1)} to {(constant + 0.5).toFixed(1)}, each dot one chart&apos;s middle score on the log scale</text>
        {ticks.map((m) => (
          <g key={m}>
            <line x1={left} x2={right} y1={ys(logOf(m))} y2={ys(logOf(m))} className="pl-graph-grid" />
            <text x={left - 8} y={ys(logOf(m)) + 4} textAnchor="end" className="pl-graph-sub">{m}%</text>
          </g>
        ))}
        {[-0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5].map((v) => (
          <text key={v} x={xs(v)} y={bottom + 18} textAnchor="middle" className="pl-graph-sub">{(constant + v).toFixed(1)}</text>
        ))}
        <text x={(left + right) / 2} y="420" textAnchor="middle" className="pl-graph-sub">chart constant</text>
        {points.map(([d, l], i) => (
          <circle key={i} cx={xs(d) + (((i * 7) % 11) - 5) * 0.9} cy={ys(l)} r="2.6" className="pl-graph-dot">
            <title>{`a ${(constant + d).toFixed(1)} chart: ${scoreOf(l).toFixed(2)}% (log gap ${l.toFixed(3)})`}</title>
          </circle>
        ))}
        <path d={path} className="pl-graph-curve" />
        <line x1={xs(0)} x2={xs(0)} y1={ys(fit.a)} y2={ys(target)} className="pl-graph-gap" />
        <circle cx={xs(0)} cy={ys(fit.a)} r="4" className="pl-graph-typical" />
        <circle cx={xs(0)} cy={ys(target)} r="6" className="pl-graph-target" />
        {/* bottom left: this chart, its gap and the typical line */}
        <line x1={xs(-0.2)} y1={topY - 13} x2={xs(0) - 6} y2={ys(target) + (gap >= 0 ? 5 : -5)} className="pl-graph-leader" />
        <text x={xs(-0.52)} y={topY} className="pl-graph-label">{title} {scoreOf(target).toFixed(2)}% (log gap {target.toFixed(3)})</text>
        <text x={xs(-0.52)} y={topY + 17} className="pl-graph-accent">gap {gap >= 0 ? '+' : '−'}{Math.abs(gap).toFixed(3)} {gap >= 0 ? 'better' : 'worse'} than the line</text>
        <text x={xs(-0.52)} y={topY + 34} className="pl-graph-sub">typical line: {scoreOf(fit.a).toFixed(2)}% (log gap {fit.a.toFixed(3)}) at {constant}</text>
      </svg>
      <figcaption>fit for this bucket: typical log gap {fit.a.toFixed(3)}, log gap per +1.0 constant {fit.S.toFixed(3)}, bend {fit.q.toFixed(3)} · maishift rank counts, fetched {example.fetched}</figcaption>
    </figure>
  );
}
