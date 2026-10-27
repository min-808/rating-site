import { unstable_cache } from 'next/cache';
import { connectMongo } from './connect-db';
import { PLAYERS_TAG } from './player-data';
import { rateSong } from './song-calc';
import { toNormalWidth, type Song } from './leaderboard';
import type { CatalogSong } from './song-catalog';

/**
 * Everyone's scores on one song, for its leaderboard (/songs/[id]). There is no table of
 * scores per song, so this reads the players who have the song in their saved scores and
 * keeps only that song's entries (the database does the trimming, so little leaves it).
 * Players who hide their scores aren't included.
 *
 * Kept for 5 minutes, and cleared with everyone else's cached records (PLAYERS_TAG).
 * Speeding this up if the player list grows: an index on { "songs.title": 1 }. Server only.
 */

export type ChartRecord = {
  webId: number;
  userId: string;
  name: string;
  pfp: string | null;
  pfpBlob: string | null;
  kind: 'standard' | 'dx';
  difficulty: string; // "master"
  achievement: number;
  fc: string | null;
  fs: string | null;
  ap: boolean;
  dxScore: number | null;
  dxMax: number | null;
  rating: number; // what this score is worth on this chart
};

const CACHE_SECONDS = 5 * 60;
const diffKey = (d: string) => String(d ?? '').toLowerCase().replace(/[^a-z]/g, '');

async function read(titles: string[]): Promise<ChartRecord[]> {
  const client = await connectMongo();
  const wanted = new Set(titles.map((t) => toNormalWidth(t).replace(/\s+/g, ' ').trim().toLowerCase()));

  const players = await client.db('maimai').collection('players').aggregate([
    { $match: { scores_opt_out: { $ne: true }, 'songs.title': { $in: titles } } },
    {
      $project: {
        _id: 0, web_id: 1, user_id: 1, name: 1, pfp: 1, pfp_blob: 1,
        songs: { $filter: { input: '$songs', as: 's', cond: { $in: ['$$s.title', titles] } } },
      },
    },
  ]).toArray();

  const records: ChartRecord[] = [];
  for (const p of players) {
    for (const s of (p.songs ?? []) as Song[]) {
      const key = toNormalWidth(s.title).replace(/\s+/g, ' ').trim().toLowerCase();
      if (!wanted.has(key) || !((s.achievement ?? 0) > 0)) continue;
      records.push({
        webId: p.web_id,
        userId: String(p.user_id ?? ''),
        name: toNormalWidth(p.name ?? ''),
        pfp: p.pfp ?? null,
        pfpBlob: p.pfp_blob ?? null,
        kind: /dx/i.test(s.kind ?? '') ? 'dx' : 'standard',
        difficulty: diffKey(s.difficulty),
        achievement: s.achievement,
        fc: s.fc ?? null,
        fs: s.fs ?? null,
        ap: Boolean(s.ap),
        dxScore: s.dx_score ?? null,
        dxMax: s.dx_max ?? null,
        rating: rateSong(s),
      });
    }
  }
  return records;
}

export function getSongRecords(song: Pick<CatalogSong, 'key' | 'titles'>): Promise<ChartRecord[]> {
  return unstable_cache(read, ['song-records-v1', song.key], {
    revalidate: CACHE_SECONDS,
    tags: [PLAYERS_TAG],
  })(song.titles);
}

/** One chart's records, best first: accuracy, then DX score, then name so ties stay put. */
export function recordsForChart(all: ChartRecord[], kind: string, difficulty: string): ChartRecord[] {
  return all
    .filter((r) => r.kind === kind && r.difficulty === difficulty)
    .sort((a, b) =>
      (b.achievement - a.achievement)
      || ((b.dxScore ?? 0) - (a.dxScore ?? 0))
      || a.name.localeCompare(b.name));
}
