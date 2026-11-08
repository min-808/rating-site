import { NextResponse } from 'next/server';
import { refreshChartFeels } from '../../../../lib/chart-feel-store';

/**
 * GET /api/chart-feel/refresh[?force=1]   updates the saved "plays like" results
 * (lib/chart-feel-store.ts) and says what it did. force=1 works every chart out again.
 *
 * Normally it runs by itself, after the nightly scrape and after a player's refresh. This is
 * for running it by hand: open in development (npm run dev), otherwise it needs the same
 * "Authorization: Bearer <CRON_SECRET>" header as the nightly job.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const allowed = process.env.NODE_ENV === 'development'
    || request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!allowed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const force = new URL(request.url).searchParams.get('force') === '1';
  return NextResponse.json(await refreshChartFeels({ force }), { headers: { 'Cache-Control': 'no-store' } });
}
