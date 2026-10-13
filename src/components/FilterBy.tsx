'use client';

import { useState } from 'react';
import LevelField from './LevelField';

/**
 * The level summary's main filter (/user/[id]/levels): by level (LevelField: one level,
 * or a range) or by difficulty (any of basic to re:master, every level of them). Radio
 * buttons pick which; the other one's boxes are greyed out, and greyed-out boxes aren't
 * sent, so the address only holds the filter in use.
 *
 * "level" is the default, so only "difficulty" puts by= in the address.
 */

const DIFFS = [
  { value: 'basic', label: 'Basic', color: '#22a352' },
  { value: 'advanced', label: 'Advanced', color: '#d99000' },
  { value: 'expert', label: 'Expert', color: '#e0403a' },
  { value: 'master', label: 'Master', color: '#9b4fd1' },
  { value: 'remaster', label: 'Re:Master', color: '#b48be0' },
];

export default function FilterBy({ byDifficulty, difficulties, level, isRange, min, max, maxRange }: {
  byDifficulty: boolean;
  difficulties: string[]; // ticked
  level: string;
  isRange: boolean;
  min: number;
  max: number;
  maxRange: number;
}) {
  const [mode, setMode] = useState<'level' | 'difficulty'>(byDifficulty ? 'difficulty' : 'level');
  const [ticked, setTicked] = useState(new Set(difficulties));
  const toggle = (value: string) => setTicked((t) => {
    const next = new Set(t);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });

  return (
    <div className="ls-filterby">
      <div className="ls-modes" role="radiogroup" aria-label="filter by">
        <label className="ls-check ls-check-inline">
          <input type="radio" checked={mode === 'level'} onChange={() => setMode('level')} />
          level
        </label>
        <label className="ls-check ls-check-inline">
          {/* the only radio with a name: "level" is the default, so it stays out of the address */}
          <input type="radio" name={mode === 'difficulty' ? 'by' : undefined} value="difficulty"
            checked={mode === 'difficulty'} onChange={() => setMode('difficulty')} />
          difficulty
        </label>
      </div>

      <LevelField level={level} isRange={isRange} min={min} max={max} maxRange={maxRange} disabled={mode !== 'level'} />

      <div className={`ls-field${mode !== 'difficulty' ? ' ls-off' : ''}`}>
        <span>difficulties</span>
        <span className="ls-diffs">
          {DIFFS.map((d) => (
            <label key={d.value} className="ls-check ls-check-inline ls-diff" style={{ '--diff': d.color } as React.CSSProperties}>
              <input type="checkbox" name="diff" value={d.value} checked={ticked.has(d.value)}
                disabled={mode !== 'difficulty'} onChange={() => toggle(d.value)}
                // at least one, or there's nothing to show
                required={mode === 'difficulty' && ticked.size === 0} />
              {d.label}
            </label>
          ))}
        </span>
      </div>
    </div>
  );
}
