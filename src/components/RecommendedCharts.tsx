import Link from 'next/link';
import FallbackImage from './FallbackImage';
import { displayTitle } from '../lib/song-id';
import { chartId } from '../lib/song-view';
import { DIFFICULTY_COLORS } from '../lib/song-browse';
import type { RecommendedChart } from '../lib/my-charts';

/**
 * A profile's "recommended charts": charts an SSS+ would raise the player's rating on (new
 * ones for their best 50, or ones in it below SSS+), the ones players at their rating SSS+
 * most often (lib/my-charts.ts), each with how much rating that SSS+ would add. Stats from maishift. A server component, no scripts:
 * the first 10 show, the rest are behind a <details> button, like the favorite songs.
 */

const SHOWN = 10;
const DIFFICULTY_TEXT: Record<string, string> = { basic: 'basic', advanced: 'advanced', expert: 'expert', master: 'master', remaster: 're:master' };

const css = `
  .rc-card { margin: 1rem 0; padding: 0.75rem 1rem 1rem; border: 1px solid var(--border-light); border-radius: 12px; font-size: 0.9rem; }
  .rc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 0 0 0.2rem; }
  .rc-head h2 { margin: 0; font-size: 0.95rem; }
  .rc-about { margin: 0 0 0.6rem; font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; }
  .rc-about a { color: inherit; }
  .rc-about code { font-family: monospace; font-size: 0.95em; padding: 0.05rem 0.3rem; border-radius: 4px;
    background: rgba(127,127,127,0.15); border: 1px solid var(--border-light); color: var(--text-sub); }
  .rc-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
  .rc-grid + details { margin-top: 8px; }
  .rc-item { position: relative; display: flex; align-items: center; gap: 10px; padding: 7px 10px 7px 7px; border: 1px solid var(--border-light);
    border-radius: 9px; text-decoration: none; color: inherit; background: var(--btn-bg); overflow: hidden; height: 100%; box-sizing: border-box; }
  .rc-item:hover { border-color: var(--border-strong); }
  .rc-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.16; pointer-events: none;
    -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0.3), #000 75%); mask-image: linear-gradient(90deg, rgba(0,0,0,0.3), #000 75%); }
  .rc-jacket { position: relative; width: 44px; height: 44px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: var(--border-light); }
  .rc-jacket img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .rc-text { position: relative; min-width: 0; flex: 1; }
  .rc-title { margin: 0; font-weight: 700; font-size: 0.85rem; line-height: 1.25; overflow-wrap: anywhere; }
  .rc-chart { margin: 1px 0 0; font-size: 0.72rem; font-weight: 700; }
  .rc-share { margin: 1px 0 0; font-size: 0.7rem; color: var(--text-muted); }
  .rc-current { color: var(--text-sub); font-weight: 600; }
  .rc-gain { position: relative; flex-shrink: 0; text-align: right; line-height: 1.1; }
  .rc-gain b { display: block; font-size: 1.05rem; color: #4f9dff; }
  .rc-gain span { font-size: 0.66rem; color: var(--text-muted); }
  .rc-more summary { cursor: pointer; font-size: 0.82rem; color: var(--text-sub); padding: 4px 0; }
  .rc-more .rc-grid { margin-top: 6px; }
`;

function Card({ item }: { item: RecommendedChart }) {
  const { song, chart } = item;
  return (
    <li>
      <Link href={`/charts/${encodeURIComponent(song.id)}#${chartId(chart)}`} className="rc-item">
        {song.jacket && <FallbackImage src={song.jacket} alt="" className="rc-bg" />}
        <span className="rc-jacket">{song.jacket && <FallbackImage src={song.jacket} alt="" />}</span>
        <span className="rc-text">
          <p className="rc-title">{displayTitle(song.title)}</p>
          <p className="rc-chart" style={{ color: DIFFICULTY_COLORS[chart.difficulty] }}>
            {chart.kind === 'dx' ? 'DX' : 'standard'} {DIFFICULTY_TEXT[chart.difficulty]} {chart.internal.toFixed(1)}
          </p>
          <p className="rc-share">
            {item.current !== null && <span className="rc-current">in best 50 · {item.current.toFixed(4)}% · </span>}
            {Math.round(item.share * 100)}% SSS+ at this rating
          </p>
        </span>
        <span className="rc-gain" title={item.current !== null ? 'already in the best 50: an SSS+ would raise what it counts for' : `an SSS+ would replace the lowest chart in their ${item.pool === 'new' ? 'B15' : 'B35'}`}>
          <b>+{item.gain}</b>
          <span>{item.pool === 'new' ? 'B15' : 'B35'}</span>
        </span>
      </Link>
    </li>
  );
}

export default function RecommendedCharts({ charts }: { charts: RecommendedChart[] }) {
  if (charts.length === 0) return null;
  const rest = charts.slice(SHOWN);

  return (
    <section className="rc-card" aria-label="recommended charts">
      <style>{css}</style>
      <div className="rc-head">
        <h2>recommended charts for rating</h2>
      </div>
      <p className="rc-about">
        the % is how many players in your rating band got an SSS+, out of everyone in the band who's played the chart
        <br />
        the recommended chart order is determined by <code>% × rating gain</code>, so charts that are both commonly SSS+'d and worth a lot of rating come first
        <br />
        <br />
        this feature is currently experimental. stats from <a href="https://maimai.shiftpsh.com" target="_blank" rel="noopener noreferrer">maishift</a>
      </p>
      <ul className="rc-grid">{charts.slice(0, SHOWN).map((c) => <Card key={`${c.song.id}-${chartId(c.chart)}`} item={c} />)}</ul>
      {rest.length > 0 && (
        <details className="rc-more">
          <summary>show {rest.length} more</summary>
          <ul className="rc-grid">{rest.map((c) => <Card key={`${c.song.id}-${chartId(c.chart)}`} item={c} />)}</ul>
        </details>
      )}
    </section>
  );
}
