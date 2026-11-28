'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import FallbackImage from './FallbackImage';
import { songPagesCss } from './song-pages-css';
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS, constantLabel, gameLevel } from '../lib/song-browse';
import { displayTitle } from '../lib/song-id';
import type { PerceivedRow } from '../lib/perceived-list';

/**
 * The chart search's "plays harder / easier" tab (app/charts/perceived): charts whose plays like
 * differs from their constant, as rows that are chart cards (jacket, title, difficulty) with the
 * numbers in columns: constant → plays like, the difference, the 95% range. Filters up top (plays
 * harder or easier, level and the constants in it, sort), the rest behind "more filters".
 * Everything filters in the browser; the list comes once from lib/perceived-list.ts.
 */

const PER_PAGE = 25;
const LEVELS = ['15', '14+', '14', '13+', '13', '12+', '12', '11+', '11'];
const DIFFS = ['remaster', 'master', 'expert'] as const;
// each sort: the first tap, then tapping it again flips it
const SORTS = {
  diff: { label: 'difference', arrows: ['most ↓', 'least ↑'] },
  constant: { label: 'constant', arrows: ['hardest ↓', 'easiest ↑'] },
  plays: { label: 'plays like', arrows: ['hardest ↓', 'easiest ↑'] },
} as const;
type SortKey = keyof typeof SORTS;

type Chart = { song: string; title: string; jacket: string | null; dx: boolean; difficulty: string; isNew: boolean; constant: number; playsLike: number; low: number; high: number; sure: boolean; dc: number };
const unpack = (r: PerceivedRow): Chart => ({ song: r[0], title: r[1], jacket: r[2], dx: r[3] === 1, difficulty: r[4], isNew: r[5] === 1, constant: r[6], playsLike: r[7], low: r[8], high: r[9], sure: r[10] === 1, dc: r[11] });
// the shown change in tenths: + plays harder
const change = (c: Chart) => Math.round((c.playsLike - c.constant) * 10);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="sg-row" role="group" aria-label={label}><span className="sg-row-label">{label}</span><div className="sg-chips">{children}</div></div>;
}
function Chip({ on, color, onClick, children }: { on: boolean; color?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`sg-chip${on ? ' is-on' : ''}${color ? ' has-color' : ''}`} aria-pressed={on} onClick={onClick}
      style={color ? ({ '--chip': color } as CSSProperties) : undefined}>{children}</button>
  );
}

export default function PerceivedBrowser({ rows, jacketBase = '', note }: { rows: PerceivedRow[]; jacketBase?: string; note?: ReactNode }) {
  const charts = useMemo(() => rows.map(unpack), [rows]);
  const [harder, setHarder] = useState(true);
  const [level, setLevel] = useState('');
  const [constant, setConstant] = useState('');
  const [pool, setPool] = useState<'' | 'new' | 'old'>('');
  const [difficulty, setDifficulty] = useState('');
  const [kind, setKind] = useState<'' | 'dx' | 'standard'>('');
  const [sureOnly, setSureOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('diff');
  const [flip, setFlip] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shown, setShown] = useState(PER_PAGE);
  const reset = () => setShown(PER_PAGE);
  const pickSort = (key: SortKey) => { setFlip(sort === key ? !flip : false); setSort(key); reset(); };

  // the constants in the picked level, from the charts there are (13+: 13.9, 13.8, 13.7, 13.6)
  const constants = useMemo(() => [...new Set(charts.filter((c) => gameLevel(c.constant) === level).map((c) => c.constant))].sort((a, b) => b - a), [charts, level]);
  const extra = [pool, difficulty, kind, sureOnly ? '1' : ''].filter(Boolean).length;

  const list = useMemo(() => {
    const out = charts.filter((c) => {
      const ch = change(c);
      if (harder ? ch <= 0 : ch >= 0) return false;
      if (level && gameLevel(c.constant) !== level) return false;
      if (constant && constantLabel(c.constant) !== constant) return false;
      if (pool && c.isNew !== (pool === 'new')) return false;
      if (difficulty && c.difficulty !== difficulty) return false;
      if (kind && c.dx !== (kind === 'dx')) return false;
      if (sureOnly && !c.sure) return false;
      return true;
    });
    // difference: the shown change, then sure before uncertain, then the full change before the cap
    const byDiff = (a: Chart, b: Chart) => Math.abs(change(b)) - Math.abs(change(a)) || Number(b.sure) - Number(a.sure) || (harder ? a.dc - b.dc : b.dc - a.dc);
    const cmp = { diff: byDiff, constant: (a: Chart, b: Chart) => b.constant - a.constant || byDiff(a, b), plays: (a: Chart, b: Chart) => b.playsLike - a.playsLike || byDiff(a, b) }[sort];
    out.sort(cmp);
    return flip ? out.reverse() : out;
  }, [charts, harder, level, constant, pool, difficulty, kind, sureOnly, sort, flip]);

  const header = (key: SortKey, label: string) => (
    <button type="button" className={sort === key ? 'is-on' : undefined} onClick={() => pickSort(key)}>
      {label}{sort === key && <span className="pc-sorted" aria-hidden="true">{SORTS[key].arrows[flip ? 1 : 0].slice(-1)}</span>}
    </button>
  );
  const groupOf = sort === 'constant' ? (c: Chart) => c.constant : sort === 'plays' ? (c: Chart) => c.playsLike : null;

  // "more filters": at the end of the lowest row shown: level, or its constants once a level is picked; once open, the last row it opened
  const moreButton = (
    <button type="button" className="pc-more" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
      {moreOpen ? 'fewer filters' : <>more filters{extra > 0 && <b className="pc-on"> ({extra} on)</b>}</>}
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={moreOpen ? { transform: 'rotate(180deg)' } : undefined}>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );

  return (
    <>
      <style>{songPagesCss}</style>
      <style>{css}</style>
      <div className="sg-panel">
        <div className="sg-rows">
          <Row label="show">
            <button type="button" className={`pc-dir is-harder${harder ? ' is-on' : ''}`} aria-pressed={harder} onClick={() => { setHarder(true); reset(); }}>plays harder</button>
            <button type="button" className={`pc-dir is-easier${!harder ? ' is-on' : ''}`} aria-pressed={!harder} onClick={() => { setHarder(false); reset(); }}>plays easier</button>
          </Row>
          <Row label="level">
            <Chip on={!level} onClick={() => { setLevel(''); setConstant(''); reset(); }}>any</Chip>
            {LEVELS.map((l) => <Chip key={l} on={level === l} onClick={() => { setLevel(l); setConstant(''); reset(); }}>{l}</Chip>)}
            {!moreOpen && !level && moreButton}
          </Row>
          {level && (
            <Row label="constant">
              <Chip on={!constant} onClick={() => { setConstant(''); reset(); }}>all {level}</Chip>
              {constants.map((c) => <Chip key={c} on={constant === constantLabel(c)} onClick={() => { setConstant(constantLabel(c)); reset(); }}>{constantLabel(c)}</Chip>)}
              {!moreOpen && moreButton}
            </Row>
          )}
          {moreOpen && <>
            <Row label="charts">
              <Chip on={!pool} onClick={() => { setPool(''); reset(); }}>all</Chip>
              <Chip on={pool === 'old'} onClick={() => { setPool('old'); reset(); }}>B35 (old songs)</Chip>
              <Chip on={pool === 'new'} onClick={() => { setPool('new'); reset(); }}>B15 (new songs)</Chip>
            </Row>
            <Row label="difficulty">
              <Chip on={!difficulty} onClick={() => { setDifficulty(''); reset(); }}>any</Chip>
              {DIFFS.map((d) => <Chip key={d} on={difficulty === d} color={DIFFICULTY_COLORS[d]} onClick={() => { setDifficulty(d); reset(); }}>{DIFFICULTY_LABELS[d].toLowerCase()}</Chip>)}
            </Row>
            <Row label="chart type">
              <Chip on={!kind} onClick={() => { setKind(''); reset(); }}>any</Chip>
              <Chip on={kind === 'dx'} onClick={() => { setKind('dx'); reset(); }}>DX</Chip>
              <Chip on={kind === 'standard'} onClick={() => { setKind('standard'); reset(); }}>standard</Chip>
            </Row>
            <Row label="how sure">
              <Chip on={!sureOnly} onClick={() => { setSureOnly(false); reset(); }}>sure and uncertain</Chip>
              <Chip on={sureOnly} onClick={() => { setSureOnly(true); reset(); }}>sure only</Chip>
              {moreButton}
            </Row>
          </>}
        </div>
        <div className="sg-sortbar" role="group" aria-label="sort by">
          <span className="sg-row-label">sort by</span>
          {(Object.keys(SORTS) as SortKey[]).map((key) => (
            <button key={key} type="button" className={`sg-sort${sort === key ? ' is-on' : ''}`} aria-pressed={sort === key} onClick={() => pickSort(key)}>
              {SORTS[key].label}{sort === key && <span className="sg-sort-dir">{SORTS[key].arrows[flip ? 1 : 0]}</span>}
            </button>
          ))}
        </div>
      </div>

      <p className="pc-count"><b>{list.length.toLocaleString('en-US')}</b> chart{list.length === 1 ? '' : 's'} play {harder ? 'harder' : 'easier'} than their constant</p>

      {list.length === 0 ? <p className="sg-empty">no charts match</p> : (
        <div className="pc-scroll">
          <table className="pc-table">
            {/* fixed shares of the full width: the table is always as wide as the filters above, and
                the room is spread over every column instead of collecting in one gap */}
            <colgroup>
              <col style={{ width: '5%' }} /><col style={{ width: '37%' }} /><col style={{ width: '11%' }} /><col style={{ width: '4%' }} />
              <col style={{ width: '11%' }} /><col style={{ width: '18%' }} /><col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="pc-num pc-rank">#</th><th>chart</th>
                <th className="pc-num">{header('constant', 'constant')}</th><th className="pc-arrow" aria-hidden="true">→</th>
                <th className="pc-num">{header('plays', 'plays like')}</th><th className="pc-num">{header('diff', 'difference')}</th><th className="pc-num">95% range</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, shown).flatMap((c, i, page) => {
                const color = DIFFICULTY_COLORS[c.difficulty];
                const ch = change(c) / 10;
                const href = `/charts/${encodeURIComponent(c.song)}`;
                const key = `${c.song}|${c.dx}|${c.difficulty}`;
                const group = groupOf && (i === 0 || groupOf(page[i - 1]) !== groupOf(c)) ? groupOf(c) : null;
                return [
                  ...(group != null ? [<tr key={`${key}-g`} className="pc-group"><td colSpan={7}>{sort === 'constant' ? 'constant' : 'plays like'} <b>{constantLabel(group)}</b></td></tr>] : []),
                  <tr key={key} className="pc-row" style={{ '--d': color } as CSSProperties}>
                    <td className="pc-num pc-rank">{i + 1}</td>
                    <td>
                      <Link href={href} className="pc-chart">
                        <span className="pc-jacket">{c.jacket ? <FallbackImage src={jacketBase + c.jacket} alt="" /> : <span aria-hidden="true">♪</span>}</span>
                        <span className="pc-text">
                          <span className="pc-name">{displayTitle(c.title)}</span>
                          <span className="pc-meta">
                            <span className="sg-kind">{c.dx ? 'DX' : 'ST'}</span>
                            <span className="sg-pill" style={{ background: color }}>{DIFFICULTY_LABELS[c.difficulty].toLowerCase()}</span>
                            {!c.sure && <span className="pc-unsure">uncertain</span>}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="pc-num pc-big">{constantLabel(c.constant)}</td>
                    <td className="pc-arrow" aria-label="plays like">→</td>
                    <td className="pc-num pc-big">{constantLabel(c.playsLike)}</td>
                    <td className="pc-num">
                      <span className={`pc-delta ${ch > 0 ? 'is-harder' : 'is-easier'}`}>{ch > 0 ? '+' : '−'}{Math.abs(ch).toFixed(1)}</span>
                      {Math.abs(c.dc) > 0.5 && <span className="pc-small">{-c.dc > 0 ? '+' : '−'}{Math.abs(c.dc).toFixed(2)} before cap</span>}
                    </td>
                    <td className="pc-num pc-small">{constantLabel(c.low)}–{constantLabel(c.high)}</td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
      {list.length > shown && (
        <button type="button" className="sg-more" onClick={() => setShown((n) => n + PER_PAGE)}>show more ({(list.length - shown).toLocaleString()} left)</button>
      )}
      <p className="pc-note">
        difference: how far a chart plays from its constant; plays like moves at most 0.5, so for charts at the cap the full amount shows as &ldquo;before cap&rdquo;.
        only sure and uncertain results are listed. {note}
      </p>
    </>
  );
}

const css = `
  .pc-dir { font: inherit; font-size: 0.82rem; font-weight: 700; line-height: 1; padding: 7px 14px; border-radius: 999px; cursor: pointer; border: 1px solid var(--border-light); background: none; color: var(--text-muted); }
  .pc-dir.is-harder.is-on { background: #c2410c; border-color: #c2410c; color: #fff; }
  .pc-dir.is-easier.is-on { background: #15803d; border-color: #15803d; color: #fff; }
  .pc-on { color: #dd2c76; }
  /* "more filters": at the end of the level row, pushed to the right */
  .pc-more { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font: inherit; font-size: 0.8rem; font-weight: 600; padding: 6px 2px; border: none; background: none; cursor: pointer; color: var(--text-muted); white-space: nowrap; }
  .pc-more:hover { color: var(--text-main); }
  .pc-more:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; border-radius: 4px; }
  .pc-count { margin: 0 0 0.6rem; font-size: 0.85rem; color: var(--text-muted); }
  .pc-count b { color: var(--text-main); }
  /* a table: every column as wide as it needs, so the numbers sit next to the chart, not across an empty gap */
  .pc-scroll { overflow-x: auto; }
  .pc-table { width: 100%; min-width: 600px; table-layout: fixed; border-collapse: separate; border-spacing: 0 4px; font-variant-numeric: tabular-nums; }
  /* the header is a row of the table too: same cell padding and edges as the rows, so the columns line up exactly */
  .pc-table th { position: sticky; top: 0; z-index: 1; padding: 7px 0.6rem; background: var(--btn-bg); border-top: 1px solid var(--border-strong); border-bottom: 1px solid var(--border-strong);
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; color: var(--text-muted); text-align: left; white-space: nowrap; }
  .pc-table th:first-child { border-left: 3px solid var(--border-strong); border-radius: 8px 0 0 8px; }
  .pc-table th:last-child { border-right: 1px solid var(--border-strong); border-radius: 0 8px 8px 0; }
  .pc-table th button { font: inherit; letter-spacing: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer; }
  .pc-table th button.is-on { color: var(--text-main); }
  /* the sort arrow hangs off the side, so the heading itself stays centred over its numbers */
  .pc-table th button { position: relative; }
  .pc-sorted { position: absolute; left: 100%; margin-left: 3px; }
  .pc-row td { padding: 5px 0.6rem; background: var(--btn-bg); border-top: 1px solid var(--border-light); border-bottom: 1px solid var(--border-light); white-space: nowrap; overflow: hidden; }
  .pc-row td:first-child { border-left: 3px solid var(--d); border-radius: 8px 0 0 8px; }
  .pc-row td:last-child { border-right: 1px solid var(--border-light); border-radius: 0 8px 8px 0; }
  .pc-row:hover td { background: var(--border-light); }
  .pc-table .pc-num { text-align: center; }
  .pc-table .pc-rank { text-align: right; }
  .pc-table .pc-arrow { text-align: center; color: var(--text-muted); padding-left: 0 !important; padding-right: 0 !important; }
  .pc-rank { font-size: 0.78rem; color: var(--text-muted); }
  .pc-chart { display: flex; gap: 8px; align-items: center; min-width: 0; color: inherit; text-decoration: none; }
  .pc-chart:hover .pc-name { text-decoration: underline; }
  .pc-jacket { width: 38px; height: 38px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: var(--border-light); display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
  .pc-jacket img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pc-text { display: grid; gap: 2px; min-width: 0; flex: 1; }
  .pc-name { font-weight: 700; font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; }
  .pc-meta { display: flex; gap: 5px; align-items: center; }
  .pc-meta .sg-kind { width: auto; }
  .pc-unsure { font-size: 0.66rem; font-weight: 700; padding: 0 6px; border-radius: 999px; border: 1px solid #ca8a04; color: #ca8a04; }
  .pc-big { font-size: 1rem; font-weight: 800; }
  .pc-delta { font-weight: 800; font-family: ui-monospace, Menlo, monospace; }
  .pc-delta.is-harder { color: #ea580c; }
  .pc-delta.is-easier { color: #16a34a; }
  .pc-small { display: block; font-size: 0.72rem; color: var(--text-muted); }
  td.pc-small { display: table-cell; }
  .pc-group td { padding: 0.6rem 0.2rem 0.1rem; font-size: 0.78rem; font-weight: 700; color: var(--text-muted); }
  .pc-group b { font-size: 0.95rem; color: var(--text-main); }
  .pc-note { margin: 1rem 0 0; font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; }
  @media (max-width: 640px) {
    .pc-row td { padding: 4px 0.4rem; }
  }
`;
