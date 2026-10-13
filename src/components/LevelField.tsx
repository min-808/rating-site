'use client';

import { useState } from 'react';

/**
 * The level summary's level filter (/user/[id]/levels): one level the way the game shows
 * them ("14" is 14.0 to 14.5, "14+" is 14.6 to 14.9), or, with "range" ticked, a range of
 * internal levels in two boxes. The second box can't go below the first or more than
 * maxRange above it: its min and max follow the first box, so the browser stops the form
 * if it's out of range. The page checks again either way.
 *
 * Only the boxes in use are drawn, so the other ones neither get sent nor stop the form.
 */
// nothing's rated above 15.0, so "15" (15.0 to 15.5) switched to a range is 15.0 to 15.0
const TOP_LEVEL = 15;

export default function LevelField({ level, isRange, min, max, maxRange, disabled = false }: {
  level: string; // "14" / "14+"
  isRange: boolean;
  min: number;
  max: number;
  maxRange: number;
  disabled?: boolean; // filtering by difficulty instead: greyed out, and not sent
}) {
  const [range, setRange] = useState(isRange);
  const [from, setFrom] = useState(min.toFixed(1));
  const low = parseFloat(from);
  const lowOk = Number.isFinite(low);

  return (
    <div className={`ls-field${disabled ? ' ls-off' : ''}`}>
      <span>{range ? 'internal level range' : 'level'}</span>
      <span className="ls-pair">
        {range ? (
          <>
            <input type="number" name="min" step="0.1" min="1" max="15" value={from} disabled={disabled}
              onChange={(e) => setFrom(e.target.value)} aria-label="lowest internal level" required />
            to
            <input type="number" name="max" step="0.1" max={lowOk ? Math.min(15, low + maxRange).toFixed(1) : '15'}
              min={lowOk ? low.toFixed(1) : '1'} defaultValue={Math.min(TOP_LEVEL, max).toFixed(1)} disabled={disabled}
              aria-label="highest internal level" required />
          </>
        ) : (
          <input type="text" name="level" inputMode="numeric" defaultValue={level} aria-label="level" disabled={disabled}
            pattern="\s*(?:(?:[7-9]|1[0-5])\+?|[1-6])\s*" title="a level, like 14 or 14+ (no + below 7)" className="ls-level" required />
        )}
        <label className="ls-check ls-check-inline">
          <input type="checkbox" name="range" value="1" checked={range} disabled={disabled} onChange={(e) => setRange(e.target.checked)} />
          range
        </label>
      </span>
    </div>
  );
}
