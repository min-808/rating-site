import type { Metadata } from 'next';
import SongBrowser from '../../components/SongBrowser';
import JumpIcon from '../../components/JumpIcon';
import { getCatalog, toBrowserList } from '../../lib/song-catalog';

/**
 * /charts: every song, searchable and filterable (components/SongBrowser.tsx). The song list
 * is joined once and kept on the server (lib/song-catalog.ts), then sent to the browser
 * slimmed down, so searching and filtering never wait on the server.
 *
 * The page reads nothing from the request (a shared ?q= search is read in the browser), so
 * Next keeps the finished page and serves it to everyone, rebuilding it once an hour.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Chart Leaderboards - HI Maimai',
  description: 'every maimai song, with its charts and who has the top score',
};

export default async function SongsPage() {
  const { songs, jacketBase } = toBrowserList(await getCatalog());

  return (
    <main className="sg-main">
      {/* same as the leaderboard's (app/page.tsx). remove once maimai NET is back */}
      <p className="sg-notice" role="status">
        the chart leaderboards are currently paused while the maimai website is down. sorry for the inconvenience!
      </p>
      <h1>
        HI Maimai Chart{' '}
        <span className="sg-title-end">
          Leaderboards
          <JumpIcon src="/favicon.ico" className="sg-title-icon" />
        </span>
      </h1>
      <SongBrowser
        songs={songs}
        jacketBase={jacketBase}
        // like the leaderboard's (app/page.tsx). the date is fixed there while the scraper is paused
        updated={<>
          Last updated on Oct 21, 2026, 12:17:14 AM HST
          <br />
          Automatically updates every day at midnight
        </>}
      />
    </main>
  );
}
