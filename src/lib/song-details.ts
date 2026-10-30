import { unstable_cache } from 'next/cache';
import { connectMongo } from './connect-db';
import { SONG_DATA_TAG } from './song-data';
import { CHART_DIFFICULTIES } from './difficulties';
import { chartId } from './song-view';
import type { CatalogSong } from './song-catalog';

/**
 * The extra details on a song's page (/charts/[id]): each chart's designer and note counts,
 * the full BPM range and when the song came to international. They're only shown there, so
 * they're read per song (one small read, kept like the rest of the song data) rather than
 * added to the whole song list, which every page that lists songs keeps in memory.
 * Server only.
 */

export type NoteCounts = { total: number; tap: number | null; hold: number | null; slide: number | null; touch: number | null; break: number | null };
export type ChartDetails = { designer: string | null; notes: NoteCounts | null };
export type SongDetails = {
  bpmRange: string | null; // "150–225", or "180" when it doesn't change
  added: string | null; // when it came to international: "2019-05-10"
  charts: Record<string, ChartDetails>; // by chart id, "std-remaster" (lib/song-view.ts)
};

const SUFFIX: Record<string, string> = { basic: 'bas', advanced: 'adv', expert: 'exp', master: 'mas', remaster: 'remas' };

const count = (value: unknown) => {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : null;
};

// otoge-db writes a changing BPM as "150-225(150)": the range, then the main BPM
function bpmRange(value: unknown): string | null {
  const text = String(value ?? '').trim();
  const range = text.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) return range[1] === range[2] ? range[1] : `${range[1]}–${range[2]}`;
  const single = text.match(/^\d+(?:\.\d+)?/);
  return single ? single[0] : null;
}

// "20190510" -> "2019-05-10"
function isoDate(value: unknown): string | null {
  const m = String(value ?? '').match(/^(\d{4})(\d{2})(\d{2})$/);
  return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// artist: when two songs share the title, which one's record (lib/song-catalog.ts docArtist)
async function read(titles: string[], artist: string | null): Promise<SongDetails> {
  const doc = await (await connectMongo()).db('maimai').collection('songs').findOne(
    { title: { $in: titles }, intl: { $ne: '0' }, ...(artist ? { artist } : {}) },
    { projection: { _id: 0 } },
  );
  const charts: Record<string, ChartDetails> = {};
  if (doc) {
    for (const kind of ['standard', 'dx'] as const) {
      for (const difficulty of CHART_DIFFICULTIES) {
        const field = `${kind === 'dx' ? 'dx_' : ''}lev_${SUFFIX[difficulty]}`;
        if (doc[field] == null) continue;
        const total = count(doc[`${field}_notes`]);
        charts[chartId({ kind, difficulty })] = {
          designer: typeof doc[`${field}_designer`] === 'string' && doc[`${field}_designer`].trim() ? doc[`${field}_designer`].trim() : null,
          notes: total === null ? null : {
            total,
            tap: count(doc[`${field}_notes_tap`]),
            hold: count(doc[`${field}_notes_hold`]),
            slide: count(doc[`${field}_notes_slide`]),
            touch: count(doc[`${field}_notes_touch`]),
            break: count(doc[`${field}_notes_break`]),
          },
        };
      }
    }
  }
  return {
    bpmRange: doc ? bpmRange(doc.bpm) : null,
    added: doc ? isoDate(doc.date_intl_added) ?? isoDate(doc.date_added) : null,
    charts,
  };
}

export function getSongDetails(song: Pick<CatalogSong, 'key' | 'titles' | 'docArtist'>): Promise<SongDetails> {
  return unstable_cache(read, ['song-details-v2', song.key], {
    revalidate: 6 * 60 * 60,
    tags: [SONG_DATA_TAG],
  })(song.titles, song.docArtist);
}
