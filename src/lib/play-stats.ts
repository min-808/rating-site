/**
 * Numbers for the profile's overview card, worked out from a player's saved scores.
 * Plain module, works on the server.
 *
 *   rank badges  the grade images under the graph (SSS+, SSS, ...), like osu!'s SS / S badges
 *   side list    the label / value rows in the panel on the right
 *
 * Counts are "or better", the way maimai counts them: an SSS+ also counts toward
 * SSS, and an AP+ also counts toward AP and FC. Set CUMULATIVE to false to count
 * each tier on its own instead.
 *
 * To add, remove or reorder anything, edit RANK_BADGES or SIDE_STATS.
 */

type Chart = {
  achievement?: number | null;
  fc?: string | null; // "fc" | "fcplus" | "ap" | "applus"
  fs?: string | null; // "sync" | "fs" | "fsplus" | "fdx" | "fdxplus"
};

const CUMULATIVE = true;

const COMBO_ORDER = ['fc', 'fcplus', 'ap', 'applus'];
const SYNC_ORDER = ['sync', 'fs', 'fsplus', 'fdx', 'fdxplus'];
// achievement cutoffs, highest first
const RANK_CUTOFFS = [100.5, 100, 99.5, 99, 98, 97];

const tierTest = (order: string[], pick: (c: Chart) => string | null | undefined) => (tier: string) => (c: Chart) => {
  const have = order.indexOf(pick(c) ?? '');
  const want = order.indexOf(tier);
  return CUMULATIVE ? have >= want : have === want;
};
const comboAtLeast = tierTest(COMBO_ORDER, (c) => c.fc);
const syncAtLeast = tierTest(SYNC_ORDER, (c) => c.fs);
const rankAtLeast = (min: number) => (c: Chart) => {
  const a = c.achievement ?? 0;
  if (CUMULATIVE) return a >= min;
  const next = RANK_CUTOFFS[RANK_CUTOFFS.indexOf(min) - 1] ?? Infinity;
  return a >= min && a < next;
};

// the grade images, the same ones the best 50 list uses: "SSS+" -> .../badge/sssp.png
const BADGE_BASE = 'https://img.himaimai.net/badge';
const gradeImage = (label: string) => `${BADGE_BASE}/${label.toLowerCase().replace(/\+/g, 'p')}.png`;

// the grades under the graph, best first
export const RANK_BADGES = [
  { label: 'SSS+', test: rankAtLeast(100.5) },
  { label: 'SSS', test: rankAtLeast(100) },
  { label: 'SS+', test: rankAtLeast(99.5) },
  { label: 'SS', test: rankAtLeast(99) },
  { label: 'S+', test: rankAtLeast(98) },
  { label: 'S', test: rankAtLeast(97) },
];

// the rows in the right-hand panel, after "charts played" and "average"
// grouped: the panel draws a divider between groups
const COMBO_STATS = [
  { label: 'AP+', test: comboAtLeast('applus') },
  { label: 'AP', test: comboAtLeast('ap') },
  { label: 'FC+', test: comboAtLeast('fcplus') },
  { label: 'FC', test: comboAtLeast('fc') },
];
const SYNC_STATS = [
  { label: 'FDX+', test: syncAtLeast('fdxplus') },
  { label: 'FDX', test: syncAtLeast('fdx') },
  { label: 'FS', test: syncAtLeast('fs') },
];

// id: set on rows the page draws itself (charts played follows the region toggle)
type SideRow = { label: string; value: string; id?: string };

export type PlayStats = {
  played: number;
  average: number | null; // mean achievement over played charts
  badges: Array<{ label: string; count: number; img: string }>;
  side: SideRow[][]; // groups of rows, top to bottom
};

// totalCharts: every chart in the game, for "unique charts played: 812 / 2,340".
// left out (or 0), only the played count shows
export function playStats(songs: Chart[] | undefined | null, totalCharts = 0): PlayStats {
  const played = (songs ?? []).filter((s) => (s.achievement ?? 0) > 0);
  const average = played.length
    ? played.reduce((sum, s) => sum + (s.achievement ?? 0), 0) / played.length
    : null;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const count = ({ label, test }: { label: string; test: (c: Chart) => boolean }): SideRow =>
    ({ label: `${label} count`, value: fmt(played.filter(test).length) });

  return {
    played: played.length,
    average,
    badges: RANK_BADGES.map(({ label, test }) => ({ label, count: played.filter(test).length, img: gradeImage(label) })),
    side: [
      [
        {
          id: 'charts-played',
          label: 'total charts played',
          value: totalCharts > 0 ? `${fmt(played.length)} / ${fmt(totalCharts)}` : fmt(played.length),
        },
        { label: 'average accuracy', value: average == null ? '-' : `${average.toFixed(4)}%` },
      ],
      COMBO_STATS.map(count),
      SYNC_STATS.map(count),
    ],
  };
}