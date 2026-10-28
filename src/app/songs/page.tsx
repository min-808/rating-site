import type { Metadata } from 'next';
import SongBrowser from '../../components/SongBrowser';
import { getCatalog, toBrowserList } from '../../lib/song-catalog';

/**
 * /songs: every song, searchable and filterable (components/SongBrowser.tsx). The song list
 * is joined once and kept on the server (lib/song-catalog.ts), then sent to the browser
 * slimmed down, so searching and filtering never wait on the server.
 *
 * The page reads nothing from the request (a shared ?q= search is read in the browser), so
 * Next keeps the finished page and serves it to everyone, rebuilding it once an hour.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Songs - HI Maimai',
  description: 'every maimai song, with its charts and who has the top score',
};

export default async function SongsPage() {
  const { songs, jacketBase } = toBrowserList(await getCatalog());

  return (
    <main className="sg-main">
      <h1>songs</h1>
      <p className="sg-sub">every song, and who has the best score on each chart. pick one to see its leaderboard.</p>
      <SongBrowser songs={songs} jacketBase={jacketBase} />
    </main>
  );
}
