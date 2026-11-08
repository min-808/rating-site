import { RATING_TIERS, tierLabel } from '../lib/rating-tiers';

/**
 * Under the rating on a profile: how far the player is from the next rating bracket
 * ("Rainbow 2★ ... 89 to go to Rainbow 3★") with a bar for the progress through the
 * current one. Brackets come from lib/rating-tiers.ts, so every star medal counts as
 * its own step. Shows nothing once the player is in the top bracket.
 */

const css = `
  .ntb { display: flex; flex-direction: column; gap: 6px; padding-top: 0.75rem; border-top: 1px solid var(--border-light); }
  .ntb-labels { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 2px 1rem; font-size: 0.85rem; }
  .ntb-min { color: var(--text-sub); font-variant-numeric: tabular-nums; }
  .ntb-need { font-weight: bold; color: #2563eb; }
  [data-theme='dark'] .ntb-need { color: #60a5fa; }
  .ntb-track { height: 8px; border-radius: 4px; background: var(--border-light); overflow: hidden; }
  .ntb-fill { height: 100%; border-radius: 4px; background: #2563eb; }
`;

export default function NextTierBar({ rating }: { rating: number }) {
  // RATING_TIERS is highest first
  const next = [...RATING_TIERS].reverse().find((t) => t.min > rating);
  if (!next) return null; // top bracket

  const current = RATING_TIERS.find((t) => t.min <= rating);
  const from = current?.min ?? 0;
  const pct = Math.max(0, Math.min(100, ((rating - from) / (next.min - from)) * 100));
  const need = next.min - rating;

  return (
    <div className="ntb">
      <style>{css}</style>
      <div className="ntb-labels">
        <span>
          {current ? <b>{tierLabel(current)}</b> : <b>unranked</b>} <span className="ntb-min">{from}</span>
        </span>
        <span>
          <span className="ntb-need">{need.toLocaleString('en-US')} to go</span> to <b>{tierLabel(next)}</b>{' '}
          <span className="ntb-min">{next.min}</span>
        </span>
      </div>
      <div
        className="ntb-track"
        role="progressbar"
        aria-label={`progress to ${tierLabel(next)}`}
        aria-valuemin={from}
        aria-valuemax={next.min}
        aria-valuenow={rating}
      >
        <div className="ntb-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
