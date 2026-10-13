'use client';

import { useState } from 'react';

/**
 * A dropdown for a GET form that stays out of the address while it's on its default
 * ("all" versions, sorting by grade): it only has a name, and so only gets sent, when
 * something else is picked. Keeps the level summary's links short (?level=13 rather
 * than ?level=13&from=&to=&sort=grade).
 */
export default function QuietSelect({ name, defaultValue, quietValue = '', options, ariaLabel }: {
  name: string;
  defaultValue: string;
  quietValue?: string; // the default: picking this leaves it out of the address
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <select name={value === quietValue ? undefined : name} value={value} onChange={(e) => setValue(e.target.value)} aria-label={ariaLabel}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
