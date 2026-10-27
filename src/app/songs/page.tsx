import type { Metadata } from 'next';
import SongBrowser from '../../components/SongBrowser';
import { getCatalog, toBrowserSong } from '../../lib/song-catalog';

/**
 * /songs: every song, searchable and filterable (components/SongBrowser.tsx). The song list
 * is joined once and kept on the server (lib/song-catalog.ts), then sent to the browser
 * slimmed down, so searching and filtering never wait on the server.
 */

export const metadata: Metadata = {
  title: 'Songs - HI Maimai',
  description: 'every maimai song, with its charts and who has the top score',
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SongsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const songs = (await getCatalog()).map(toBrowserSong);

  return (
    <main className="sg-main">
      <h1>songs</h1>
      <p className="sg-sub">every song, and who has the best score on each chart. pick one to see its leaderboard.</p>
      <SongBrowser songs={songs} initialQuery={typeof q === 'string' ? q : ''} />
    </main>
  );
}
