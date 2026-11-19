import type { Metadata } from 'next';
import SongBrowser from '../../components/SongBrowser';
import JumpIcon from '../../components/JumpIcon';
import { getCatalog, toBrowserList } from '../../lib/song-catalog';
import { connectMongo } from '../../lib/connect-db';

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

// when the nightly update last ran (api/update-leaderboard), written like the leaderboard's
async function lastUpdatedText() {
  const metadata = await (await connectMongo()).db('maimai').collection<{ _id: string; lastUpdated?: Date }>('metadata')
    .findOne({ _id: 'leaderboard_update' });
  return (metadata?.lastUpdated ? new Date(metadata.lastUpdated) : new Date()).toLocaleString('en-US', {
    timeZone: 'Pacific/Honolulu', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZoneName: 'short',
  });
}

export default async function SongsPage() {
  const { songs, jacketBase } = toBrowserList(await getCatalog());

  return (
    <main className="sg-main">
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
        // the same update time as the leaderboard's (app/page.tsx)
        updated={<>
          Last updated on {await lastUpdatedText()}
          <br />
          Automatically updates every day at midnight
        </>}
      />
    </main>
  );
}
