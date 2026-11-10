import { NextResponse } from 'next/server';

/**
 * GET /api/maishift/test   development only: checks that the maishift API key works.
 *
 * Makes one request to maishift (every 13.3 chart, for players rated 14,750-14,999, North
 * America) and says how it went: the HTTP status, the rate limit left, how big the reply
 * was, and the first few charts' numbers. It saves nothing and never shows the key.
 * On the live site it answers 404, so only `npm run dev` can use it.
 */
export const dynamic = 'force-dynamic';

const URL = 'https://maimai.shiftpsh.com/api/v1/stats/level-charts?region=na&internalLevel=133&rating=14750-15000';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') return new NextResponse('Not found', { status: 404 });

  // read from .env (MAISHIFT_API_KEY=...). never written into a reply or a log
  const key = process.env.MAISHIFT_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: 'MAISHIFT_API_KEY is not set in .env (restart npm run dev after adding it)' });

  const started = Date.now();
  const res = await fetch(URL, { headers: { 'X-API-Key': key }, cache: 'no-store' });
  const text = await res.text();

  const summary = {
    ok: res.ok,
    status: res.status,
    ms: Date.now() - started,
    replyBytes: text.length,
    // how much of maishift's rate limit is left (this request costs 15 of 120)
    rateLimit: res.headers.get('X-RateLimit-Limit'),
    rateLimitRemaining: res.headers.get('X-RateLimit-Remaining'),
  };
  // maishift's own error (e.g. invalid_api_key, rate_limited): passed on so you can see what went wrong
  if (!res.ok) return NextResponse.json({ ...summary, error: text.slice(0, 500) });

  const data = JSON.parse(text) as {
    band: { from: number; to: number };
    charts: Array<{ chartId: number; players: number; suppressed: boolean; counts: Record<string, number> | null }>;
  };
  return NextResponse.json({
    ...summary,
    band: data.band,
    charts: data.charts.length,
    hidden: data.charts.filter((c) => c.suppressed).length, // fewer than 5 players: maishift leaves the numbers out
    firstFive: data.charts.slice(0, 5),
  });
}
