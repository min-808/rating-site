import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SongPageView from '../../../components/SongPageView';
import { getCatalogSong } from '../../../lib/song-catalog';
import { getSongRecords } from '../../../lib/song-records';
import { buildSongView } from '../../../lib/song-view';
import { isGf } from '../../../lib/special-players';

/**
 * /songs/[id]: one song, laid out like osu!'s beatmap page (components/SongPageView.tsx).
 *
 * The page reads nothing from the request (no cookies, no ?query: the chart being looked
 * at lives after the # and is read in the browser), so Next keeps the finished page and
 * serves it to everyone, rebuilding it at most every 5 minutes. That means a busy song
 * costs one server run and one database read per 5 minutes, not one per visitor.
 * Players who hide their scores aren't on it (lib/song-records.ts).
 */

export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const song = await getCatalogSong(id);
  if (!song) return { title: '404 - HI Maimai' };
  return {
    title: `${song.title} - HI Maimai`,
    description: `${song.title}${song.artist ? ` by ${song.artist}` : ''}: charts and the top scores`,
  };
}

export default async function SongPage({ params }: Props) {
  const { id } = await params;
  const song = await getCatalogSong(id);
  if (!song) notFound();

  const records = await getSongRecords(song);
  const view = buildSongView(song.charts, records, isGf);

  return (
    <SongPageView
      song={{ title: song.title, artist: song.artist, genre: song.genre, bpm: song.bpm, version: song.version, na: song.na, jacket: song.jacket }}
      view={view}
    />
  );
}
