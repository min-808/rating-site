'use client';

import { useState } from 'react';

/**
 * The level summary's NA / international choice: NA (the default, same as the profile's
 * level breakdown) leaves out songs North America doesn't have, international counts every
 * chart. Only "international" puts anything in the address (region=intl): the NA radio has
 * no name, so it isn't sent.
 */
export default function RegionRadios({ region }: { region: 'na' | 'intl' }) {
  const [value, setValue] = useState(region);
  return (
    <div className="ls-field">
      <span>region</span>
      <span className="ls-pair" role="radiogroup" aria-label="region">
        <label className="ls-check ls-check-inline">
          <input type="radio" checked={value === 'na'} onChange={() => setValue('na')} />
          na
        </label>
        <label className="ls-check ls-check-inline">
          <input type="radio" name={value === 'intl' ? 'region' : undefined} value="intl"
            checked={value === 'intl'} onChange={() => setValue('intl')} />
          international
        </label>
      </span>
    </div>
  );
}
