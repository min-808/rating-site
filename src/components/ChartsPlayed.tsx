'use client';

import { useChartRegion } from './chart-region';

type Counts = { played: number; total: number };

const fmt = (n: number) => n.toLocaleString('en-US');

// "812 / 2,340", for whichever region the level chart's toggle is on
export default function ChartsPlayed({ na, intl }: { na: Counts; intl: Counts }) {
  const { played, total } = useChartRegion() === 'na' ? na : intl;
  return <>{total > 0 ? `${fmt(played)} / ${fmt(total)}` : fmt(played)}</>;
}
