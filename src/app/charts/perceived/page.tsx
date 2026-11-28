import type { Metadata } from 'next';
import Link from 'next/link';
import ChartsTabs from '../../../components/ChartsTabs';
import JumpIcon from '../../../components/JumpIcon';
import PerceivedBrowser from '../../../components/PerceivedBrowser';
import { getPerceivedList } from '../../../lib/perceived-list';

/**
 * /charts/perceived: the chart search's second tab, charts that play harder or easier than their
 * constant (components/PerceivedBrowser.tsx), from the saved "plays like" results
 * (lib/perceived-list.ts). The same for everyone, so Next keeps the page and rebuilds it hourly.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Plays Harder or Easier - HI Maimai',
  description: 'maimai charts that play harder or easier than their constant',
};

export default async function PerceivedPage() {
  const { rows, jacketBase } = await getPerceivedList();
  return (
    <main className="sg-main">
      <h1>
        HI Maimai Chart{' '}
        <span className="sg-title-end">
          Leaderboards
          <JumpIcon src="/favicon.ico" className="sg-title-icon" />
        </span>
      </h1>
      <ChartsTabs on="perceived" />
      <PerceivedBrowser rows={rows} jacketBase={jacketBase} note={<>
        from each chart&apos;s &ldquo;plays like&rdquo; (<Link href="/plays-like">how it&apos;s worked out</Link>), with data from{' '}
        <a href="https://maimai.shiftpsh.com" target="_blank" rel="noopener noreferrer">maishift</a>&apos;s US players. unofficial, not affiliated with SEGA.
      </>} />
    </main>
  );
}
