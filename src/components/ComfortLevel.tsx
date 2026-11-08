import Link from 'next/link';
import type { ComfortSummary } from '../lib/comfort-level';

/**
 * "Your comfort level" on a player's own profile (only they see it): the constant where an
 * SSS+ is worth about their average best-50 chart (lib/comfort-level.ts), the range to score
 * consistently in, the range to push into, and the constants where an SSS+ would raise their
 * rating. A server component, no scripts.
 */

const css = `
  .cl-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 0 0 0.75rem; }
  .cl-head h2 { margin: 0; font-size: 1rem; }
  .cl-head small { font-size: 0.75rem; color: var(--text-muted); }
  .cl-level { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 0 0 0.9rem; }
  .cl-level b { font-size: 2.2rem; line-height: 1; font-variant-numeric: tabular-nums; }
  .cl-level span { font-size: 0.85rem; color: var(--text-sub); max-width: 32rem; }
  .cl-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .cl-tile { border: 1px solid var(--border-light); border-radius: 10px; padding: 0.7rem 0.85rem; }
  .cl-tile small { display: block; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; color: var(--text-muted); }
  .cl-tile b { display: block; font-size: 1.25rem; margin: 2px 0; font-variant-numeric: tabular-nums; }
  .cl-tile span { font-size: 0.8rem; color: var(--text-sub); }
  .cl-tile.is-push b { color: #e2622f; }
  .cl-raise { margin: 0.9rem 0 0; font-size: 0.85rem; color: var(--text-sub); }
`;

const level = (n: number) => n.toFixed(1);

export default function ComfortLevel({ summary }: { summary: ComfortSummary }) {
  const { raiseNew, raiseOld } = summary;
  return (
    <section className="profile-box" aria-label="your comfort level">
      <style>{css}</style>
      <div className="cl-head">
        <h2>your comfort level</h2>
        <small>only you can see this</small>
      </div>

      <div className="cl-level">
        <b>{level(summary.level)}</b>
        <span>an SSS+ on a {level(summary.level)} is worth about as much as your average best 50 chart (your rating ÷ 50).</span>
      </div>

      <div className="cl-tiles">
        <div className="cl-tile">
          <small>comfort zone</small>
          <b>{level(summary.comfortZone[0])}–{level(summary.comfortZone[1])}</b>
          <span>charts at your level. good for scoring consistently</span>
        </div>
        <div className="cl-tile is-push">
          <small>push for</small>
          <b>{level(summary.push[0])}–{level(summary.push[1])}</b>
          <span>a step above your level, where your skill and rating grow</span>
        </div>
      </div>

      {(raiseNew != null || raiseOld != null) && (
        <p className="cl-raise">
          an SSS+ raises your rating on
          {raiseNew != null && <> new-version charts from <b>{level(raiseNew)}</b></>}
          {raiseNew != null && raiseOld != null && ' and'}
          {raiseOld != null && <> older charts from <b>{level(raiseOld)}</b></>}
          . <Link href="/charts?raise=1&sort=easiest">see those charts →</Link>
        </p>
      )}
    </section>
  );
}
