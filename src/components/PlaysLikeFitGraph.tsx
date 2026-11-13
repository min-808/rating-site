import type { WorkedExampleData } from '../lib/plays-like-worked';

/**
 * Step 4's picture on the "how plays like works" page: every comparison chart in one rating band
 * as a dot (its constant across, its middle score with popularity evened out up), the fitted
 * typical curve, and where the example chart sits against it. Drawn from a worked example's
 * graph (lib/plays-like-worked.ts). The axis fits the band's scores; labels sit in the corners
 * the falling curve leaves empty. No hooks: renders on the server.
 */
export default function PlaysLikeFitGraph({ example }: { example: WorkedExampleData }) {
  const { graph, constant, title, featured } = example;
  const { fit, target, points } = graph;
  const band = example.bands.find((b) => b.from_ === featured)!;
  const left = 64, right = 740, y0 = 70, bottom = 380;
  // the axis: from just under the lowest 2% of scores to just over the highest, within 90–101.5
  const sorted = points.map((p) => p[1]).sort((a, b) => a - b);
  const low = Math.max(90, Math.floor(Math.min(sorted[Math.floor(sorted.length * 0.02)], target, fit.a) - 0.5));
  const high = Math.min(101.5, Math.ceil(Math.max(sorted[sorted.length - 1], target, fit.a) + 0.3));
  const xs = (d: number) => left + ((d + 0.55) / 1.1) * (right - left);
  const ys = (m: number) => bottom - ((Math.max(low, Math.min(high, m)) - low) / (high - low)) * (bottom - y0);
  const curveAt = (d: number) => fit.a - fit.S * d + fit.q * d * d;
  const path = Array.from({ length: 23 }, (_, i) => -0.55 + i * 0.05)
    .map((d, i) => `${i ? 'L' : 'M'}${xs(d).toFixed(1)},${ys(curveAt(d)).toFixed(1)}`).join(' ');
  const gap = target - fit.a;
  const ticks = Array.from({ length: Math.floor(high) - Math.ceil(low) + 1 }, (_, i) => Math.ceil(low) + i);
  const topY = y0 + 20; // the empty top-right corner
  const lowY = bottom - 16; // the empty bottom-left corner
  return (
    <figure className="pl-graph">
      <svg viewBox="0 0 760 430" role="img" aria-label={`step 4: ${title} sits ${Math.abs(gap).toFixed(2)}% ${gap >= 0 ? 'above' : 'below'} the typical curve at ${constant}`}>
        <text x={left} y="24" className="pl-graph-title">{title} sits {Math.abs(gap).toFixed(2)}% {gap >= 0 ? 'above' : 'below'} the typical curve at {constant}</text>
        <text x={left} y="44" className="pl-graph-sub">band {band.from_.toLocaleString('en-US')}–{band.to.toLocaleString('en-US')} · {points.length} recent charts from {(constant - 0.5).toFixed(1)} to {(constant + 0.5).toFixed(1)}, each dot one chart&apos;s middle score (popularity evened out)</text>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={left} x2={right} y1={ys(v)} y2={ys(v)} className="pl-graph-grid" />
            <text x={left - 8} y={ys(v) + 4} textAnchor="end" className="pl-graph-sub">{v}%</text>
          </g>
        ))}
        {[-0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5].map((v) => (
          <text key={v} x={xs(v)} y={bottom + 18} textAnchor="middle" className="pl-graph-sub">{(constant + v).toFixed(1)}</text>
        ))}
        <text x={(left + right) / 2} y="420" textAnchor="middle" className="pl-graph-sub">chart constant</text>
        {points.map(([d, m], i) => (
          <circle key={i} cx={xs(d) + (((i * 7) % 11) - 5) * 0.9} cy={ys(m)} r="2.6" className="pl-graph-dot">
            <title>{`a ${(constant + d).toFixed(1)} chart: ${m.toFixed(2)}%`}</title>
          </circle>
        ))}
        <path d={path} className="pl-graph-curve" />
        <line x1={xs(0)} x2={xs(0)} y1={ys(fit.a)} y2={ys(target)} className="pl-graph-gap" />
        <circle cx={xs(0)} cy={ys(fit.a)} r="4" className="pl-graph-typical" />
        <circle cx={xs(0)} cy={ys(target)} r="6" className="pl-graph-target" />
        {/* top right: this chart and its gap */}
        <line x1={xs(0.13) - 4} y1={topY + 2} x2={xs(0) + 6} y2={ys(target) - 5} className="pl-graph-leader" />
        <text x={xs(0.13)} y={topY} className="pl-graph-label">{title} {target.toFixed(2)}%</text>
        <text x={xs(0.13)} y={topY + 17} className="pl-graph-accent">gap {gap >= 0 ? '+' : '−'}{Math.abs(gap).toFixed(2)}% {gap >= 0 ? 'above' : 'below'} the curve</text>
        {/* bottom left: the typical score */}
        <line x1={xs(-0.3)} y1={lowY - 13} x2={xs(0) - 4} y2={ys(fit.a) + 4} className="pl-graph-leader" />
        <text x={xs(-0.52)} y={lowY} className="pl-graph-sub">typical curve, {fit.a.toFixed(2)}% at {constant}</text>
      </svg>
      <figcaption>fit for this band: typical score {fit.a.toFixed(2)}%, accuracy per +1.0 constant {fit.S.toFixed(2)}%, bend {fit.q.toFixed(2)}, popularity boost {fit.beta.toFixed(2)}% per doubling · maishift rank counts, fetched {example.fetched}</figcaption>
    </figure>
  );
}
