import Link from 'next/link';

/** The two tabs at the top of the chart search: every chart (/charts), and plays harder / easier (/charts/perceived). */
export default function ChartsTabs({ on }: { on: 'all' | 'perceived' }) {
  return (
    <nav className="ct-tabs" aria-label="chart search">
      <style>{css}</style>
      <Link href="/charts" className={on === 'all' ? 'is-on' : undefined} aria-current={on === 'all' ? 'page' : undefined}>all charts</Link>
      <Link href="/charts/perceived" className={on === 'perceived' ? 'is-on' : undefined} aria-current={on === 'perceived' ? 'page' : undefined}>plays harder / easier</Link>
    </nav>
  );
}

const css = `
  .ct-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 1rem; padding-bottom: 8px; border-bottom: 1px solid var(--border-light); }
  .ct-tabs a { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--btn-border); background: var(--btn-bg); color: var(--btn-text, var(--text-main)); font-size: 0.88rem; font-weight: 600; text-decoration: none; }
  .ct-tabs a.is-on { background: #dd2c76; border-color: #dd2c76; color: #fff; }
  .ct-tabs a:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
`;
