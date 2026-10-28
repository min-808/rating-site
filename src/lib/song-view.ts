import type { CatalogChart } from './song-catalog';
import type { ChartRecord } from './song-records';

/**
 * What a song's page shows, packed small: each player once, and each chart's leaderboard as
 * rows that point at a player. Built on the server, then sent to the page's one client
 * component, which switches between charts without asking the server again. Plain module.
 */

export type ViewPlayer = {
  webId: number;
  name: string;
  gf: boolean; // gets the pink name, like on the leaderboard
  pfp: string | null;
  pfpBlob: string | null;
};

export type ViewRow = {
  p: number; // index into players
  acc: number; // accuracy, 100.5123
  dx: number | null; // DX score
  dxMax: number | null;
  fc: string | null;
  fs: string | null;
  ap: boolean;
  rating: number; // what this score is worth on this chart
};

export type ViewChart = {
  id: string; // "dx-master", also what goes after the # in the address
  kind: 'standard' | 'dx';
  difficulty: string;
  internal: number;
  level: string | null;
  rows: ViewRow[]; // best first
};

export type SongView = { players: ViewPlayer[]; charts: ViewChart[]; defaultChart: string };

export const chartId = (c: { kind: string; difficulty: string }) => `${c.kind === 'dx' ? 'dx' : 'std'}-${c.difficulty}`;

/** Best first: accuracy, then DX score, then name so equal scores always sit in the same order. */
export function compareRecords(a: ChartRecord, b: ChartRecord): number {
  return (b.achievement - a.achievement)
    || ((b.dxScore ?? 0) - (a.dxScore ?? 0))
    || a.name.localeCompare(b.name);
}

export function buildSongView(charts: CatalogChart[], records: ChartRecord[], isPinkName: (userId: string) => boolean): SongView {
  const players: ViewPlayer[] = [];
  const indexOf = new Map<number, number>();

  const viewCharts: ViewChart[] = charts.map((c) => ({
    id: chartId(c),
    kind: c.kind,
    difficulty: c.difficulty,
    internal: c.internal,
    level: c.level,
    rows: records
      .filter((r) => r.kind === c.kind && r.difficulty === c.difficulty)
      .sort(compareRecords)
      .map((r) => {
        let p = indexOf.get(r.webId);
        if (p === undefined) {
          p = players.length;
          indexOf.set(r.webId, p);
          players.push({ webId: r.webId, name: r.name, gf: isPinkName(r.userId), pfp: r.pfp, pfpBlob: r.pfpBlob });
        }
        return { p, acc: r.achievement, dx: r.dxScore, dxMax: r.dxMax, fc: r.fc, fs: r.fs, ap: r.ap, rating: r.rating };
      }),
  }));

  // opens on the hardest chart (DX first on a tie)
  const hardest = [...viewCharts].sort((a, b) => (b.internal - a.internal) || (Number(b.kind === 'dx') - Number(a.kind === 'dx')))[0];
  return { players, charts: viewCharts, defaultChart: hardest.id };
}
