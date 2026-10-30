'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import FallbackImage from './FallbackImage';
import FavoriteHeart from './FavoriteHeart';
import { favoriteHeartCss } from './favorite-heart-css';
import { songDetailCss } from './song-detail-css';
import { songLinks } from '../lib/song-links';
import { displayTitle, titleInWords } from '../lib/song-id';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS, constantLabel, gameLevel } from '../lib/song-browse';
import { rankFor, rateSong } from '../lib/song-calc';
import { rankImage, comboBadge, syncBadge } from '../lib/badges';
import type { Song } from '../lib/leaderboard';
import type { SongView, ViewChart, ViewRow, ViewPlayer } from '../lib/song-view';
import type { SongDetails } from '../lib/song-details';
import { fetchMe } from './me';

/**
 * A song's page (/charts/<id>): the cover banner with the chart picker, then the ranking
 * (the best score as a card, everyone else as a table) beside a column of details.
 * (Layout inspired by osu!'s beatmap page.)
 *
 * Every chart's ranking arrives with the page, so picking a chart is instant and never asks
 * the server. The open chart is kept in the address after the #, e.g. /charts/<id>#dx-master
 * (chart ids are built in lib/song-view.ts: "std-" or "dx-" + the difficulty). Because the
 * address has no ?query, the page itself can be cached.
 *
 * Styles: components/song-detail-css.ts (every class starts with "song-").
 */

/** How many ranking rows show at first, and how many more each "show more" adds. */
const RANKING_ROWS_PER_PAGE = 50;

/** The song's own details, shown in the banner and the info box. */
export type SongInfo = {
  id: string; // the song's address (/charts/<id>), also used by the favorite heart
  title: string;
  artist: string | null;
  genre: string | null;
  bpm: number | null;
  version: string | null;
  na: boolean; // playable in North America
  jacket: string | null; // cover image address
};

/** The short text printed inside each round difficulty button. */
const DIFFICULTY_BUTTON_TEXT: Record<string, string> = { basic: 'bas', advanced: 'adv', expert: 'exp', master: 'mas', remaster: 're:m' };

/** "DX" or "standard", for labels and tooltips. lower case like the rest of the site (DX is a name) */
const chartTypeName = (chartType: string) => (chartType === 'dx' ? 'DX' : 'standard');

/** Whether a score is an all perfect (AP or AP+). */
const isAllPerfect = (row: ViewRow) => row.ap || /^ap/i.test(row.fc ?? '');

/** A player's profile picture, or an empty square when they have none. */
function PlayerAvatar({ player, className }: { player: ViewPlayer; className: string }) {
  if (!player.pfpBlob && !player.pfp) return <span className={className} aria-hidden="true" />;
  return <FallbackImage src={player.pfpBlob ?? undefined} fallbackSrc={player.pfp ?? undefined} alt="" className={className} width={56} height={56} />;
}

/** The full combo (FC / AP) and full sync (FS / FDX) badges of one score, or "-" when there are none. */
function ComboSyncBadges({ row }: { row: ViewRow }) {
  const comboBadgeImage = comboBadge({ fc: row.fc ?? undefined, ap: row.ap });
  const syncBadgeImage = syncBadge({ fs: row.fs ?? undefined });
  if (!comboBadgeImage && !syncBadgeImage) return <span>-</span>;
  return (
    <span className="song-combo-sync-badges">
      {comboBadgeImage && <img src={comboBadgeImage.src} alt={comboBadgeImage.label} title={comboBadgeImage.label} loading="lazy" />}
      {syncBadgeImage && <img src={syncBadgeImage.src} alt={syncBadgeImage.label} title={syncBadgeImage.label} loading="lazy" />}
    </span>
  );
}

/** A score as a big card: the #1 score at the top, and yours under it when you aren't #1. */
function ScoreCard({ row, player, position, isMine = false }: { row: ViewRow; player: ViewPlayer; position: number; isMine?: boolean }) {
  const grade = rankFor(row.acc)?.rank; // "SSS+"
  return (
    <div className={`song-top-score${isMine ? ' is-mine' : ''}`}>
      <div className="song-top-score-grade">
        <span>#{position + 1}</span>
        {grade && <img src={rankImage(grade)} alt={grade} />}
      </div>
      <PlayerAvatar player={player} className="song-player-avatar" />
      <div className="song-top-score-player">
        <Link href={`/user/${player.webId}`} className={`song-player-link${player.gf ? ' gf-name' : ''}`}>{player.name}</Link>
      </div>
      <div className="song-top-score-stats">
        <div className="song-top-score-stat"><small>accuracy</small><b>{row.acc.toFixed(4)}%</b></div>
        {row.dx != null && row.dxMax ? <div className="song-top-score-stat"><small>DX score</small><b>{row.dx.toLocaleString()}</b></div> : null}
        <div className="song-top-score-stat"><small>combo / sync</small><b><ComboSyncBadges row={row} /></b></div>
        <div className="song-top-score-stat"><small>rating</small><b className="accent">{row.rating}</b></div>
      </div>
    </div>
  );
}

// "2019-05-10" -> "May 10, 2019". the month keeps its capital: a lowercase date reads oddly
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateLabel = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
};

export default function SongPageView({ song, view, details }: { song: SongInfo; view: SongView; details?: SongDetails }) {
  // which chart is open ("dx-master"), and how many of its ranking rows are showing
  const [selectedChartId, setSelectedChartId] = useState(view.defaultChart);
  const [visibleRowCount, setVisibleRowCount] = useState(RANKING_ROWS_PER_PAGE);

  // the signed-in player, so their own row can be highlighted. asked from the browser, so
  // the page itself stays the same for everyone and can be cached
  const [myWebId, setMyWebId] = useState<number | null>(null);
  useEffect(() => {
    fetchMe() // the same request the header's account button makes (components/me.ts)
      .then((me) => setMyWebId(me.signedIn ? me.webId ?? null : null))
      .catch(() => {});
  }, []);

  // open the chart named in the address (#dx-master), now and whenever it changes (back / forward)
  useEffect(() => {
    const openChartFromAddress = () => {
      const chartIdInAddress = window.location.hash.replace(/^#/, '');
      if (view.charts.some((chart) => chart.id === chartIdInAddress)) {
        setSelectedChartId(chartIdInAddress);
        setVisibleRowCount(RANKING_ROWS_PER_PAGE);
      }
    };
    openChartFromAddress();
    window.addEventListener('hashchange', openChartFromAddress);
    return () => window.removeEventListener('hashchange', openChartFromAddress);
  }, [view.charts]);

  /** Open a chart and put it in the address. */
  const selectChart = (chartId: string) => {
    setSelectedChartId(chartId);
    setVisibleRowCount(RANKING_ROWS_PER_PAGE);
    window.history.replaceState(null, '', `#${chartId}`); // no scrolling, no extra history entry
  };

  const selectedChart: ViewChart = view.charts.find((chart) => chart.id === selectedChartId) ?? view.charts[0];
  const ranking = selectedChart.rows; // every score on the open chart, best first
  const difficultyColor = DIFFICULTY_COLORS[selectedChart.difficulty];
  const difficultyLabel = DIFFICULTY_LABELS[selectedChart.difficulty] ?? selectedChart.difficulty; // "Master"

  // numbers about the open chart, for the details column
  const chartStats = useMemo(() => {
    const playerCount = ranking.length;
    // the rating a score at this accuracy would be worth on this chart
    const ratingAt = (accuracy: number, allPerfect: boolean) =>
      rateSong({ achievement: accuracy, ap: allPerfect, internal_difficulty: selectedChart.internal } as Song);
    return {
      playerCount,
      averageAccuracy: playerCount ? ranking.reduce((total, row) => total + row.acc, 0) / playerCount : null,
      sssPlusCount: ranking.filter((row) => row.acc >= 100.5).length,
      allPerfectCount: ranking.filter(isAllPerfect).length,
      sssPlusRating: ratingAt(100.5, false),
      sssPlusAllPerfectRating: ratingAt(100.5, true),
    };
  }, [ranking, selectedChart.internal]);

  // the open chart's designer and notes (lib/song-details.ts), and its notes by type: "1,165 tap · 72 hold · 90 slide · 15 break"
  const chartDetails = details?.charts[selectedChart.id];
  const noteBreakdown = chartDetails?.notes
    ? (['tap', 'hold', 'slide', 'touch', 'break'] as const)
      .filter((type) => (chartDetails.notes![type] ?? 0) > 0)
      .map((type) => ({ type, count: chartDetails.notes![type]! }))
    : [];
  // the scraper doesn't record DX scores yet, so the column only shows once a score on this chart has one
  const hasDxScores = ranking.some((row) => row.dx != null && row.dxMax);

  const lookupLinks = songLinks({ title: song.title, artist: song.artist, kind: selectedChart.kind, difficultyLabel });
  const topScore = ranking[0];
  const topScorePlayer = topScore ? view.players[topScore.p] : null;
  // where the signed-in player is on the open chart (-1: not on it, or not signed in)
  const myPosition = myWebId === null ? -1 : ranking.findIndex((row) => view.players[row.p].webId === myWebId);

  // the chart picker: an ST / DX toggle, then a tab for each of the open type's charts (easiest to hardest)
  const availableChartTypes = (['standard', 'dx'] as const).filter((chartType) => view.charts.some((chart) => chart.kind === chartType));
  const chartsOfSelectedType = view.charts.filter((chart) => chart.kind === selectedChart.kind);

  /** Flip the ST / DX toggle: open the same difficulty in the other type if it has one, otherwise its hardest chart. */
  const switchChartType = (chartType: 'standard' | 'dx') => {
    if (chartType === selectedChart.kind) return;
    const sameDifficulty = view.charts.find((chart) => chart.kind === chartType && chart.difficulty === selectedChart.difficulty);
    const hardest = view.charts.filter((chart) => chart.kind === chartType).sort((a, b) => b.internal - a.internal)[0];
    const target = sameDifficulty ?? hardest;
    if (target) selectChart(target.id);
  };

  /** One difficulty tab (bas / adv / exp / mas / re:m). */
  const renderDifficultyButton = (chart: ViewChart) => {
    const isSelected = chart.id === selectedChart.id;
    const name = `${chartTypeName(chart.kind)} ${DIFFICULTY_LABELS[chart.difficulty].toLowerCase()}`;
    const playerCountText = `${chart.rows.length} player${chart.rows.length === 1 ? '' : 's'}`;
    return (
      <button
        key={chart.id}
        type="button"
        className={`song-difficulty-button${isSelected ? ' is-open' : ''}`}
        style={{ ['--difficulty-color' as string]: DIFFICULTY_COLORS[chart.difficulty] }}
        onClick={() => selectChart(chart.id)}
        title={`${name} · ${constantLabel(chart.internal)} · ${playerCountText}`}
        aria-label={name}
        aria-pressed={isSelected}
      >
        {/* the difficulty, with the chart's level beside it ("bas 7+") */}
        <span className="song-pill-text">{DIFFICULTY_BUTTON_TEXT[chart.difficulty] ?? chart.difficulty}</span>
        <span className="song-difficulty-level">{chart.level ?? gameLevel(chart.internal)}</span>
      </button>
    );
  };

  /** One labeled progress bar in the "chart" box. percent is 0-100; barColor defaults to the accent blue. */
  const renderStatBar = (name: string, valueText: string, percent: number, barColor?: string) => (
    <div className="song-stat-bar" key={name}>
      <div className="song-stat-bar-label"><span>{name}</span><span>{valueText}</span></div>
      <div className="song-stat-bar-track">
        <div
          className="song-stat-bar-fill"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%`, ...(barColor ? { ['--bar-color' as string]: barColor } : {}) }}
        />
      </div>
    </div>
  );

  return (
    <main className="song-page">
      <style>{songDetailCss}</style>
      <style>{favoriteHeartCss}</style>
      <p className="song-back-link"><Link href="/charts">&larr; all charts</Link></p>

      <div className="song-card">
        {/* ============ banner: cover, tags, title, chart picker ============ */}
        <header className="song-banner">
          {song.jacket && <div className="song-banner-blurred-cover" style={{ backgroundImage: `url(${song.jacket})` }} aria-hidden="true" />}
          <div className="song-banner-shade" aria-hidden="true" />

          <FavoriteHeart id={song.id} className="fh-hero song-favorite-heart" />

          <div className="song-banner-tags">
            {song.genre && <span className="song-tag">{song.genre}</span>}
            {song.version && <span className="song-tag">{song.version}</span>}
            {!song.na && <span className="song-tag warn">not in north america</span>}
          </div>

          <div className="song-banner-title-row">
            {song.jacket && <div className="song-cover"><FallbackImage src={song.jacket} alt={`${titleInWords(song.title)} jacket`} loading="eager" /></div>}
            <div className="song-title-block">
              <h1>{displayTitle(song.title)}</h1>
              {song.artist && <p className="song-artist">{song.artist}</p>}
            </div>
          </div>

          <div className="song-chart-select-row">
            {availableChartTypes.length > 1 && (
              <div className="song-chart-type-toggle" role="group" aria-label="chart type">
                {availableChartTypes.map((chartType) => (
                  <button
                    key={chartType}
                    type="button"
                    className={`song-chart-type-button${chartType === selectedChart.kind ? ' is-on' : ''}`}
                    onClick={() => switchChartType(chartType)}
                    aria-pressed={chartType === selectedChart.kind}
                    title={`${chartTypeName(chartType)} charts`}
                  >
                    <span className="song-pill-text">{chartType === 'dx' ? 'DX' : 'ST'}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="song-difficulty-buttons" role="group" aria-label={`${chartTypeName(selectedChart.kind)} charts`}>
              {chartsOfSelectedType.map(renderDifficultyButton)}
            </div>
            <div className="song-selected-chart" style={{ ['--difficulty-color' as string]: difficultyColor }}>
              <b>{difficultyLabel.toLowerCase()}</b>
              <span className="song-selected-chart-constant">{constantLabel(selectedChart.internal)}</span>
              <small>{chartTypeName(selectedChart.kind)}</small>
            </div>
          </div>
        </header>

        <div className="song-body">
          {/* ============ left: the ranking ============ */}
          <section className="song-ranking-column">
            <div className="song-ranking-header">
              <h2>global ranking</h2>
              <span className="song-ranking-player-count">{chartStats.playerCount} score{chartStats.playerCount === 1 ? '' : 's'}</span>
            </div>

            {!topScore ? (
              <p className="song-ranking-empty">no one has a score on this chart yet</p>
            ) : (
              <>
                {/* the #1 score, as a big card */}
                {/* when the #1 is yours, it's marked as yours instead of showing your score twice */}
                {myPosition === 0 && <p className="song-my-score-label">your score</p>}
                <ScoreCard row={topScore} player={topScorePlayer!} position={0} isMine={myPosition === 0} />
                {/* your own score under it when it isn't #1, so you can see it without scrolling the list */}
                {myPosition > 0 && (
                  <>
                    <p className="song-my-score-label">your score</p>
                    <ScoreCard row={ranking[myPosition]} player={view.players[ranking[myPosition].p]} position={myPosition} isMine />
                  </>
                )}

                {/* everyone, as a table */}
                <div className="song-ranking-scroll">
                  <table className="song-ranking-table">
                    <thead>
                      <tr>
                        <th>rank</th><th>grade</th><th>accuracy</th><th>player</th>{hasDxScores && <th>DX score</th>}<th>combo / sync</th><th className="r">rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.slice(0, visibleRowCount).map((row, position) => {
                        const player = view.players[row.p]; // row.p is the player's index in view.players
                        const grade = rankFor(row.acc)?.rank;
                        return (
                          <tr key={`${row.p}-${position}`} className={myWebId !== null && player.webId === myWebId ? 'is-me' : undefined}>
                            <td className="song-ranking-position">#{position + 1}</td>
                            <td className="song-ranking-grade">{grade && <img src={rankImage(grade)} alt={grade} loading="lazy" />}</td>
                            <td className="song-ranking-accuracy">{row.acc.toFixed(4)}%</td>
                            <td>
                              <Link href={`/user/${player.webId}`} className={`song-player-link${player.gf ? ' gf-name' : ''}`}>
                                <PlayerAvatar player={player} className="song-player-avatar" />
                                {player.name}
                              </Link>
                            </td>
                            {hasDxScores && <td>{row.dx != null && row.dxMax ? `${row.dx.toLocaleString()} / ${row.dxMax.toLocaleString()}` : '-'}</td>}
                            <td><ComboSyncBadges row={row} /></td>
                            <td className="song-ranking-rating r">{row.rating}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {ranking.length > visibleRowCount && (
                  <button type="button" className="song-ranking-show-more" onClick={() => setVisibleRowCount((count) => count + RANKING_ROWS_PER_PAGE)}>
                    show more ({ranking.length - visibleRowCount} left)
                  </button>
                )}
              </>
            )}
          </section>

          {/* ============ right: details ============ */}
          <aside className="song-details-column">
            <section className="song-details-box">
              <h3>chart</h3>
              {/* constants run from 1.0 to 15.5, so this maps that range onto 0-100% */}
              {renderStatBar('level constant', constantLabel(selectedChart.internal), ((selectedChart.internal - 1) / 14) * 100)}
              {chartStats.playerCount > 0 && renderStatBar('SSS+ count', `${chartStats.sssPlusCount} / ${chartStats.playerCount}`, (chartStats.sssPlusCount / chartStats.playerCount) * 100, '#6fd16f')}
              {chartStats.playerCount > 0 && renderStatBar('AP count', `${chartStats.allPerfectCount} / ${chartStats.playerCount}`, (chartStats.allPerfectCount / chartStats.playerCount) * 100, '#ffd24a')}
            </section>

            {/* the chart itself: who made it, its notes, its BPM, when it came out */}
            {(chartDetails?.designer || chartDetails?.notes || details?.bpmRange || song.bpm || details?.added) && (
              <section className="song-details-box">
                <h3>details</h3>
                <dl className="song-details-list">
                  {chartDetails?.designer && <div><dt>designer</dt><dd>{chartDetails.designer}</dd></div>}
                  {chartDetails?.notes && (
                    <div>
                      <dt>notes</dt>
                      {/* the count by note type shows on hover (or a tap / tab on it): each type's
                          count over its name, in even columns */}
                      {noteBreakdown.length > 0 ? (
                        <dd className="song-notes-hover" tabIndex={0} aria-label={`${chartDetails.notes.total} notes: ${noteBreakdown.map(({ type, count }) => `${count} ${type}`).join(', ')}`}>
                          {chartDetails.notes.total.toLocaleString()}
                          <span className="song-note-breakdown" aria-hidden="true">
                            {noteBreakdown.map(({ type, count }) => (
                              <span key={type}><b>{count.toLocaleString()}</b>{type}</span>
                            ))}
                          </span>
                        </dd>
                      ) : (
                        <dd>{chartDetails.notes.total.toLocaleString()}</dd>
                      )}
                    </div>
                  )}
                  {/* the full range when it changes ("150–225") */}
                  {(details?.bpmRange || song.bpm) && <div><dt>BPM</dt><dd>{details?.bpmRange ?? song.bpm}</dd></div>}
                  {details?.added && <div><dt>added</dt><dd>{dateLabel(details.added)}</dd></div>}
                </dl>
              </section>
            )}

            {/* playing it: the most a score can be worth, and how people do */}
            <section className="song-details-box">
              <h3>gameplay</h3>
              <dl className="song-details-list">
                <div><dt>SSS+ rating</dt><dd>{chartStats.sssPlusRating} ({chartStats.sssPlusAllPerfectRating} AP)</dd></div>
                {/* every note is worth up to 3 DX score */}
                {chartDetails?.notes && <div><dt>max DX score</dt><dd>{(chartDetails.notes.total * 3).toLocaleString()}</dd></div>}
                {chartStats.averageAccuracy != null && <div><dt>average acc</dt><dd>{chartStats.averageAccuracy.toFixed(4)}%</dd></div>}
              </dl>
            </section>

            <section className="song-details-box">
              <h3>watch &amp; look up</h3>
              <div className="song-lookup-links">
                {lookupLinks.map((link) => (
                  <a key={link.label} className="song-lookup-link" href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.icon === 'search' ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                    )}
                    <span>{link.label}<small>{link.sub}</small></span>
                  </a>
                ))}
              </div>
              <p className="song-details-note">note: scores are each player&apos;s best on this site. players who hide their scores aren&apos;t listed</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
