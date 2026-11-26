'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import FallbackImage from './FallbackImage';
import { displayTitle } from '../lib/song-id';
import { chartId } from '../lib/song-view';
import { DIFFICULTY_COLORS } from '../lib/song-browse';
import type { FarmPick, FarmRange } from '../lib/farm-picks';

// 5 drawn without repeats, each one's chance proportional to its weight (the same as lib/farm-picks.ts,
// copied so this browser component doesn't pull in the server-side catalog)
const drawWeighted = <T extends { weight: number }>(list: T[], count = SHOW) =>
  list.map((item) => ({ item, key: Math.pow(Math.random(), 1 / Math.max(item.weight, 1e-6)) }))
    .sort((a, b) => b.key - a.key).slice(0, count).map((x) => x.item);

/**
 * "Rating farm picks" on a profile (experimental, next to the recommended charts for comparison):
 * SHOW charts drawn by weight from the heaviest (lib/farm-picks.ts), each showing the chart and its
 * weight, with how it plays and why it was picked behind "details". All / B35 / B15 picks which half
 * of the best 50 they'd join; buttons draw again, show the heaviest, or list the 25 heaviest. A bar
 * shows the player's level range from their best 50. The first render shows the heaviest (the same
 * on the server and the browser); the random draw happens once it's on the page.
 */

const DRAW_FROM = 25;
const SHOW = 6;
const DIFFICULTY_TEXT: Record<string, string> = { basic: 'basic', advanced: 'advanced', expert: 'expert', master: 'master', remaster: 're:master' };

const css = `
  .fp-card { margin: 1rem 0; padding: 0.75rem 1rem 1rem; border: 1px solid var(--border-light); border-radius: 12px; font-size: 0.9rem; }
  .fp-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; margin: 0 0 0.2rem; }
  .fp-head h2 { margin: 0; font-size: 0.95rem; }
  .fp-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
  .fp-btn { all: unset; cursor: pointer; font-size: 0.75rem; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--btn-border); background: var(--btn-bg); color: var(--text-sub); }
  .fp-btn:hover { border-color: var(--border-strong); }
  .fp-btn[aria-pressed="true"] { border-color: #4f9dff; color: #4f9dff; }
  .fp-btn:focus-visible { outline: 2px solid #4f9dff; outline-offset: 2px; }
  .fp-about { margin: 0 0 0.6rem; font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; }
  .fp-range { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0 0 0.6rem; font-size: 0.75rem; color: var(--text-sub); }
  .fp-range b { font-variant-numeric: tabular-nums; }
  .fp-seg { display: inline-flex; border: 1px solid var(--btn-border); border-radius: 999px; overflow: hidden; }
  .fp-seg button { all: unset; cursor: pointer; font-size: 0.75rem; padding: 4px 10px; color: var(--text-muted); background: var(--btn-bg); }
  .fp-seg button[aria-pressed="true"] { background: #4f9dff; color: #fff; }
  .fp-seg button:focus-visible { outline: 2px solid #4f9dff; outline-offset: -2px; }
  .fp-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; margin: 0 0 0.6rem; }
  .fp-level { margin: 0 0 0.75rem; }
  .fp-scale { position: relative; height: 34px; margin: 18px 6px 16px; }
  .fp-track { position: absolute; left: 0; right: 0; top: 14px; height: 6px; border-radius: 3px; background: var(--border-light); }
  .fp-zone { position: absolute; top: 12px; height: 10px; border-radius: 5px; }
  .fp-zone.is-comfort { background: rgba(60, 207, 159, 0.55); }
  .fp-zone.is-reach { background: rgba(79, 157, 255, 0.35); }
  .fp-zone-label { position: absolute; top: -16px; font-size: 0.66rem; color: var(--text-muted); white-space: nowrap; transform: translateX(-50%); }
  .fp-you { position: absolute; top: 6px; width: 2px; height: 22px; margin-left: -1px; background: var(--text-main); border-radius: 1px; }
  .fp-tick { position: absolute; top: 26px; font-size: 0.64rem; color: var(--text-muted); transform: translateX(-50%); font-variant-numeric: tabular-nums; }
  .fp-pin { position: absolute; top: 9px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: #4f9dff; color: #fff; font-size: 0.6rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center; border: 2px solid var(--bg-color); box-sizing: border-box; }
  .fp-level-text { font-size: 0.72rem; color: var(--text-muted); }
  .fp-num { display: inline-flex; width: 16px; height: 16px; border-radius: 50%; background: #4f9dff; color: #fff; font-size: 0.6rem; font-weight: 700; align-items: center; justify-content: center; margin-right: 4px; vertical-align: 1px; }
  .fp-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
  .fp-item { position: relative; display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 7px 10px 7px 7px;
    border: 1px solid var(--border-light); border-radius: 9px; background: var(--btn-bg); overflow: hidden; height: 100%; box-sizing: border-box; }
  .fp-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.14; pointer-events: none;
    -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0.3), #000 75%); mask-image: linear-gradient(90deg, rgba(0,0,0,0.3), #000 75%); }
  .fp-jacket { position: relative; width: 44px; height: 44px; border-radius: 6px; overflow: hidden; background: var(--border-light); }
  .fp-jacket img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .fp-text { position: relative; min-width: 0; }
  .fp-title { margin: 0; font-weight: 700; font-size: 0.85rem; line-height: 1.25; overflow-wrap: anywhere; color: inherit; text-decoration: none; }
  .fp-title:hover { text-decoration: underline; }
  .fp-chart { margin: 1px 0 0; font-size: 0.72rem; font-weight: 700; }
  .fp-sub { margin: 1px 0 0; font-size: 0.7rem; color: var(--text-muted); }
  .fp-weight { position: relative; text-align: right; line-height: 1.1; }
  .fp-weight b { display: block; font-size: 1.05rem; color: #4f9dff; font-variant-numeric: tabular-nums; }
  .fp-weight span { font-size: 0.66rem; color: var(--text-muted); }
  .fp-details { position: relative; grid-column: 1 / -1; font-size: 0.72rem; }
  .fp-details summary { cursor: pointer; color: var(--text-sub); }
  .fp-dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 2px 10px; margin: 4px 0 0; }
  .fp-dl dt { color: var(--text-muted); }
  .fp-dl dd { margin: 0; color: var(--text-sub); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .fp-unc { color: #ffb020; font-weight: 700; }
  .fp-table-wrap { overflow-x: auto; margin-top: 10px; }
  .fp-table { border-collapse: collapse; width: 100%; font-size: 0.74rem; font-variant-numeric: tabular-nums; }
  .fp-table th, .fp-table td { padding: 4px 7px; border-bottom: 1px solid var(--border-light); text-align: right; white-space: nowrap; }
  .fp-table th { color: var(--text-muted); font-weight: 600; }
  .fp-table td:nth-child(2), .fp-table th:nth-child(2) { text-align: left; white-space: normal; min-width: 11em; }
  .fp-table a { color: inherit; }
`;

type Props = { picks: FarmPick[]; total: number; totals?: { old: number; new: number }; range: FarmRange; playerConstant: number };

const chartLine = (p: FarmPick) => `${p.kind === 'dx' ? 'DX' : 'standard'} ${DIFFICULTY_TEXT[p.difficulty] ?? p.difficulty} ${p.constant.toFixed(1)}${p.level ? ` · lv ${p.level}` : ''}`;
const href = (p: FarmPick) => `/charts/${encodeURIComponent(p.songId)}#${chartId(p)}`;

function Card({ p, n }: { p: FarmPick; n: number }) {
  const range = p.feel.low != null && p.feel.high != null && p.feel.low !== p.feel.high ? `${p.feel.low.toFixed(1)}–${p.feel.high.toFixed(1)}` : p.feel.playsLike.toFixed(1);
  const t = p.feel.top;
  return (
    <li className="fp-item">
      {p.jacket && <FallbackImage src={p.jacket} alt="" className="fp-bg" />}
      <span className="fp-jacket">{p.jacket && <FallbackImage src={p.jacket} alt="" />}</span>
      <span className="fp-text">
        <Link href={href(p)} className="fp-title"><span className="fp-num" aria-hidden="true">{n}</span>{displayTitle(p.title)}</Link>
        <p className="fp-chart" style={{ color: DIFFICULTY_COLORS[p.difficulty] }}>{chartLine(p)}</p>
        <p className="fp-sub">{p.current != null ? `best ${p.current.toFixed(4)}%${p.inBest50 ? ' (in best 50)' : ''}` : 'not played yet'} · {p.pool === 'new' ? 'B15' : 'B35'}</p>
      </span>
      <span className="fp-weight" title="weight: easier + rating + fit (halved when plays like is uncertain)">
        <b>{p.weight.toFixed(2)}</b>
        <span>weight</span>
      </span>
      <details className="fp-details">
        <summary>details</summary>
        <dl className="fp-dl">
          <dt>plays like</dt><dd>{p.feel.playsLike.toFixed(1)} ({p.disparity.toFixed(1)} easier) · likely {range}{p.feel.unsure && <> · <span className="fp-unc">uncertain</span></>}</dd>
          <dt>measured from</dt><dd>{p.feel.players.toLocaleString('en-US')} maishift players in {p.feel.buckets} rating buckets</dd>
          {t && <><dt>most say</dt><dd>rated {t.from.toLocaleString('en-US')}–{t.to.toLocaleString('en-US')} ({t.players}): {t.middle.toFixed(2)}% vs a typical {p.constant.toFixed(1)} at {t.typical.toFixed(2)}%</dd></>}
          <dt>rating</dt><dd>+{p.gain} with an SSS+{p.usual != null ? ` · likely ${p.usual.toFixed(2)}% → +${p.likelyGain}` : ''}</dd>
          <dt>weight</dt><dd>{p.weight.toFixed(2)} = easier {p.easier.toFixed(2)} + rating {p.rating.toFixed(2)} + fit {p.fit.toFixed(2)}{p.feel.unsure ? ' × 0.5' : ''}</dd>
        </dl>
      </details>
    </li>
  );
}

/** The player's level range from their best 50, with the shown picks placed on it by plays like. */
function LevelBar({ range, picks }: { range: FarmRange; picks: FarmPick[] }) {
  const lo = Math.floor((Math.min(range.q25 - 0.4, ...picks.map((p) => p.feel.playsLike)) ) * 2) / 2;
  const hi = Math.ceil((Math.max(range.q90 + 0.3, ...picks.map((p) => p.feel.playsLike))) * 2) / 2;
  const at = (c: number) => `${((c - lo) / (hi - lo)) * 100}%`;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += 0.5) ticks.push(Math.round(t * 10) / 10);
  const width = (a: number, b: number) => `${Math.max(1.5, ((b - a) / (hi - lo)) * 100)}%`;
  // picks at the same plays like sit side by side
  const seen = new Map<string, number>();
  return (
    <div className="fp-level">
      <div className="fp-scale" role="img" aria-label={`comfortable ${range.q25.toFixed(1)} to ${range.q75.toFixed(1)}, reach up to ${range.q90.toFixed(1)}, felt level ${range.mean.toFixed(2)}`}>
        <span className="fp-track" />
        <span className="fp-zone is-reach" style={{ left: at(range.q75), width: width(range.q75, range.q90) }} />
        <span className="fp-zone is-comfort" style={{ left: at(range.q25), width: width(range.q25, range.q75) }} />
        <span className="fp-zone-label" style={{ left: at((range.q25 + range.q75) / 2) }}>comfortable</span>
        {range.q90 > range.q75 && <span className="fp-zone-label" style={{ left: at((range.q75 + range.q90) / 2 + 0.05) }}>reach</span>}
        <span className="fp-you" style={{ left: at(range.mean) }} title={`felt level ${range.mean.toFixed(2)}`} />
        {picks.map((p, i) => {
          const k = p.feel.playsLike.toFixed(1);
          const dup = seen.get(k) ?? 0;
          seen.set(k, dup + 1);
          return <span key={i} className="fp-pin" style={{ left: `calc(${at(p.feel.playsLike)} + ${dup * 12}px)` }} title={`${i + 1}: plays like ${k}`}>{i + 1}</span>;
        })}
        {ticks.map((t) => <span key={t} className="fp-tick" style={{ left: at(t) }}>{t.toFixed(1)}</span>)}
      </div>
      <p className="fp-level-text">
        where this player&apos;s best 50 sits by plays like: the green band is the middle half of it (comfortable, {range.q25.toFixed(1)}–{range.q75.toFixed(1)}), the blue band goes up to the 90th percentile (reach, {range.q90.toFixed(1)}), the line is the average ({range.mean.toFixed(2)}). the numbered dots are the picks below, by how they play.
      </p>
    </div>
  );
}

export default function FarmPicks({ picks, total, totals, range, playerConstant }: Props) {
  const [pool, setPool] = useState<'all' | 'old' | 'new'>('all');
  const inPool = (list: FarmPick[], which: typeof pool) => (which === 'all' ? list : list.filter((p) => p.pool === which));
  const [shown, setShown] = useState<FarmPick[]>(() => picks.slice(0, SHOW));
  const [mode, setMode] = useState<'draw' | 'top'>('top');
  const [list, setList] = useState(false);
  const draw = (which = pool) => { setShown(drawWeighted(inPool(picks, which).slice(0, DRAW_FROM))); setMode('draw'); };
  const showTop = (which = pool) => { setShown(inPool(picks, which).slice(0, SHOW)); setMode('top'); };
  useEffect(() => { draw(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (picks.length === 0) return null;
  const current = inPool(picks, pool);
  const count = pool === 'all' ? total : totals?.[pool] ?? current.length;
  const choosePool = (which: typeof pool) => { setPool(which); if (mode === 'draw') draw(which); else showTop(which); };

  return (
    <section className="fp-card" aria-label="rating farm picks">
      <style>{css}</style>
      <div className="fp-head">
        <h2>rating farm picks</h2>
        <div className="fp-buttons">
          <button type="button" className="fp-btn" aria-pressed={mode === 'draw'} onClick={() => draw()}>draw again</button>
          <button type="button" className="fp-btn" aria-pressed={mode === 'top'} onClick={() => showTop()}>top {SHOW} by weight</button>
          <button type="button" className="fp-btn" aria-pressed={list} onClick={() => setList((v) => !v)}>{list ? 'hide' : 'show'} top {Math.min(25, current.length)}</button>
        </div>
      </div>
      <p className="fp-about">
        charts this player hasn&apos;t SSS+&apos;d that would raise their rating and play easier than their constant, near the level their best 50 feels like.
        {' '}weight = easier + rating + fit. experimental, US international charts only. plays like from <a href="/plays-like">maishift data</a>
      </p>
      <div className="fp-controls">
        <div className="fp-seg" role="group" aria-label="which half of the best 50">
          <button type="button" aria-pressed={pool === 'all'} onClick={() => choosePool('all')}>all</button>
          <button type="button" aria-pressed={pool === 'old'} onClick={() => choosePool('old')}>B35</button>
          <button type="button" aria-pressed={pool === 'new'} onClick={() => choosePool('new')}>B15</button>
        </div>
        <span className="fp-level-text">
          {mode === 'draw' ? `${Math.min(SHOW, current.length)} drawn by weight from the ${Math.min(DRAW_FROM, current.length)} heaviest of ${count}` : `the ${Math.min(SHOW, current.length)} heaviest of ${count}`} · best 50 constant average {playerConstant.toFixed(2)}
        </span>
      </div>
      <LevelBar range={range} picks={shown} />
      {shown.length === 0 ? <p className="fp-level-text">no charts qualify in this half yet.</p> : (
        <ul className="fp-grid">{shown.map((p, i) => <Card key={`${p.songId}-${chartId(p)}`} p={p} n={i + 1} />)}</ul>
      )}
      {list && (
        <div className="fp-table-wrap">
          <table className="fp-table">
            <thead><tr><th>#</th><th>chart</th><th>const</th><th>plays like</th><th>best</th><th>+SSS+</th><th>likely</th><th>easier</th><th>rating</th><th>fit</th><th>weight</th></tr></thead>
            <tbody>
              {current.slice(0, 25).map((p, i) => (
                <tr key={`${p.songId}-${chartId(p)}`}>
                  <td>{i + 1}</td>
                  <td><Link href={href(p)}>{displayTitle(p.title)}</Link> <span style={{ color: DIFFICULTY_COLORS[p.difficulty], fontWeight: 700 }}>{p.kind === 'dx' ? 'DX' : 'STD'} {DIFFICULTY_TEXT[p.difficulty]}</span> <span style={{ color: 'var(--text-muted)' }}>{p.pool === 'new' ? 'B15' : 'B35'}</span></td>
                  <td>{p.constant.toFixed(1)}</td>
                  <td>{p.feel.playsLike.toFixed(1)}{p.feel.unsure ? ' ?' : ''}</td>
                  <td>{p.current != null ? `${p.current.toFixed(2)}%` : '—'}</td>
                  <td>+{p.gain}</td>
                  <td>{p.usual != null ? `+${p.likelyGain}` : '—'}</td>
                  <td>{p.easier.toFixed(2)}</td><td>{p.rating.toFixed(2)}</td><td>{p.fit.toFixed(2)}</td>
                  <td><b>{p.weight.toFixed(2)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
