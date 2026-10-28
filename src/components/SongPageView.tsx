'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import FallbackImage from './FallbackImage';
import { songDetailCss } from './song-detail-css';
import { songLinks } from '../lib/song-links';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS, constantLabel } from '../lib/song-browse';
import { rankFor, rateSong } from '../lib/song-calc';
import { rankImage, comboBadge, syncBadge } from '../lib/badges';
import type { Song } from '../lib/leaderboard';
import type { SongView, ViewChart, ViewRow, ViewPlayer } from '../lib/song-view';

/**
 * A song's page, laid out like osu!'s beatmap page: the cover banner with a row of round
 * chart icons, then the ranking (the best score as a card, everyone else as a table) beside
 * a panel of details. Everything for every chart arrives with the page, so picking a chart
 * is instant and never asks the server; the chart is kept in the address after the # (like
 * osu!'s /beatmapsets/962088#osu/2014469), e.g. /songs/<id>#dx-master. Because the address
 * has no ?query, the page itself can be cached.
 */

const PAGE_SIZE = 50;

export type SongInfo = {
  title: string;
  artist: string | null;
  genre: string | null;
  bpm: number | null;
  version: string | null;
  na: boolean;
  jacket: string | null;
};

const isAp = (r: ViewRow) => r.ap || /^ap/i.test(r.fc ?? '');

function Avatar({ player, className }: { player: ViewPlayer; className: string }) {
  if (!player.pfpBlob && !player.pfp) return <span className={className} aria-hidden="true" />;
  return <FallbackImage src={player.pfpBlob ?? undefined} fallbackSrc={player.pfp ?? undefined} alt="" className={className} width={56} height={56} />;
}

function Badges({ row }: { row: ViewRow }) {
  const combo = comboBadge({ fc: row.fc ?? undefined, ap: row.ap });
  const sync = syncBadge({ fs: row.fs ?? undefined });
  if (!combo && !sync) return <span>-</span>;
  return (
    <span className="osu-badges">
      {combo && <img src={combo.src} alt={combo.label} title={combo.label} loading="lazy" />}
      {sync && <img src={sync.src} alt={sync.label} title={sync.label} loading="lazy" />}
    </span>
  );
}

export default function SongPageView({ song, view }: { song: SongInfo; view: SongView }) {
  const [chartId, setChartId] = useState(view.defaultChart);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // the chart in the address (#dx-master), now and when it changes (back / forward)
  useEffect(() => {
    const fromHash = () => {
      const wanted = window.location.hash.replace(/^#/, '');
      if (view.charts.some((c) => c.id === wanted)) { setChartId(wanted); setLimit(PAGE_SIZE); }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [view.charts]);

  const pick = (id: string) => {
    setChartId(id);
    setLimit(PAGE_SIZE);
    window.history.replaceState(null, '', `#${id}`); // no scrolling, no extra history entry
  };

  const chart: ViewChart = view.charts.find((c) => c.id === chartId) ?? view.charts[0];
  const rows = chart.rows;
  const color = DIFFICULTY_COLORS[chart.difficulty];
  const label = DIFFICULTY_LABELS[chart.difficulty] ?? chart.difficulty;

  const stats = useMemo(() => {
    const n = rows.length;
    const asScore = (acc: number, ap: boolean) => rateSong({ achievement: acc, ap, internal_difficulty: chart.internal } as Song);
    return {
      n,
      average: n ? rows.reduce((t, r) => t + r.acc, 0) / n : null,
      sssPlus: rows.filter((r) => r.acc >= 100.5).length,
      ap: rows.filter(isAp).length,
      sssPlusRating: asScore(100.5, false),
      sssPlusApRating: asScore(100.5, true),
    };
  }, [rows, chart.internal]);

  const links = songLinks({ title: song.title, artist: song.artist, kind: chart.kind, difficultyLabel: label });
  const top = rows[0];
  const topPlayer = top ? view.players[top.p] : null;
  const topRank = top ? rankFor(top.acc)?.rank : null;

  const std = view.charts.filter((c) => c.kind === 'standard');
  const dx = view.charts.filter((c) => c.kind === 'dx');
  const dot = (c: ViewChart) => (
    <button
      key={c.id}
      type="button"
      className={`osu-dot${c.id === chart.id ? ' is-open' : ''}`}
      style={{ ['--dot' as string]: DIFFICULTY_COLORS[c.difficulty] }}
      onClick={() => pick(c.id)}
      title={`${c.kind === 'dx' ? 'DX' : 'Standard'} ${DIFFICULTY_LABELS[c.difficulty]} · ${constantLabel(c.internal)} · ${c.rows.length} player${c.rows.length === 1 ? '' : 's'}`}
      aria-label={`${c.kind === 'dx' ? 'DX' : 'Standard'} ${DIFFICULTY_LABELS[c.difficulty]}`}
      aria-pressed={c.id === chart.id}
    >
      {c.kind === 'dx' ? 'DX' : 'ST'}
    </button>
  );

  const bar = (name: string, value: string, pct: number, fill?: string) => (
    <div className="osu-bar" key={name}>
      <div className="osu-bar-top"><span>{name}</span><span>{value}</span></div>
      <div className="osu-track"><div className="osu-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, ...(fill ? { ['--fill' as string]: fill } : {}) }} /></div>
    </div>
  );

  return (
    <main className="osu-page">
      <style>{songDetailCss}</style>
      <p className="osu-crumb"><Link href="/songs">&larr; all songs</Link></p>

      <div className="osu">
        <header className="osu-hero">
          {song.jacket && <div className="osu-hero-bg" style={{ backgroundImage: `url(${song.jacket})` }} aria-hidden="true" />}
          <div className="osu-hero-shade" aria-hidden="true" />

          <div className="osu-hero-top">
            {song.genre && <span className="osu-tag">{song.genre}</span>}
            {song.version && <span className="osu-tag">{song.version}</span>}
            {song.bpm ? <span className="osu-tag">{song.bpm} BPM</span> : null}
            {!song.na && <span className="osu-tag warn">not in North America</span>}
          </div>

          <div className="osu-hero-main">
            {song.jacket && <div className="osu-jacket"><FallbackImage src={song.jacket} alt={`${song.title} jacket`} loading="eager" /></div>}
            <div className="osu-titles">
              <h1>{song.title}</h1>
              {song.artist && <p className="osu-artist">{song.artist}</p>}
            </div>
          </div>

          <div className="osu-picker-row">
            <div className="osu-picker" role="group" aria-label="charts">
              {std.map(dot)}
              {std.length > 0 && dx.length > 0 && <span className="osu-group-gap" aria-hidden="true" />}
              {dx.map(dot)}
            </div>
            <div className="osu-picked" style={{ ['--dot' as string]: color }}>
              <b>{label}</b>
              <span className="osu-star">{constantLabel(chart.internal)}</span>
              <small>{chart.kind === 'dx' ? 'DX' : 'Standard'}{chart.level ? ` · level ${chart.level}` : ''}</small>
            </div>
          </div>
        </header>

        <div className="osu-body">
          <section className="osu-left">
            <div className="osu-head">
              <h2>Global Ranking</h2>
              <span className="osu-count">{stats.n} player{stats.n === 1 ? '' : 's'}</span>
            </div>

            {!top ? (
              <p className="osu-empty">no one has a score on this chart yet</p>
            ) : (
              <>
                <div className="osu-top">
                  <div className="osu-top-rank">
                    {topRank && <img src={rankImage(topRank)} alt={topRank} />}
                    <span>#1</span>
                  </div>
                  <Avatar player={topPlayer!} className="osu-avatar" />
                  <div className="osu-top-who">
                    <small>top score</small>
                    <Link href={`/user/${topPlayer!.webId}`} className={`osu-player${topPlayer!.gf ? ' gf-name' : ''}`}>{topPlayer!.name}</Link>
                  </div>
                  <div className="osu-top-stats">
                    <div className="osu-stat"><small>accuracy</small><b>{top.acc.toFixed(4)}%</b></div>
                    {top.dx != null && top.dxMax ? <div className="osu-stat"><small>DX score</small><b>{top.dx.toLocaleString()}</b></div> : null}
                    <div className="osu-stat"><small>combo / sync</small><b><Badges row={top} /></b></div>
                    <div className="osu-stat"><small>rating</small><b className="pink">{top.rating}</b></div>
                  </div>
                </div>

                <div className="osu-scroll">
                  <table className="osu-table">
                    <thead>
                      <tr>
                        <th>rank</th><th></th><th>accuracy</th><th>player</th><th>DX score</th><th>combo / sync</th><th className="r">rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, limit).map((r, i) => {
                        const player = view.players[r.p];
                        const grade = rankFor(r.acc)?.rank;
                        return (
                          <tr key={`${r.p}-${i}`} className={i === 0 ? 'is-first' : undefined}>
                            <td className="osu-pos">#{i + 1}</td>
                            <td className="osu-grade">{grade && <img src={rankImage(grade)} alt={grade} loading="lazy" />}</td>
                            <td className="osu-acc">{r.acc.toFixed(4)}%</td>
                            <td>
                              <Link href={`/user/${player.webId}`} className={`osu-player${player.gf ? ' gf-name' : ''}`}>
                                <Avatar player={player} className="osu-avatar" />
                                {player.name}
                              </Link>
                            </td>
                            <td>{r.dx != null && r.dxMax ? `${r.dx.toLocaleString()} / ${r.dxMax.toLocaleString()}` : '-'}</td>
                            <td><Badges row={r} /></td>
                            <td className="osu-rating r">{r.rating}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {rows.length > limit && (
                  <button type="button" className="osu-more" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                    show more ({rows.length - limit} left)
                  </button>
                )}
              </>
            )}
          </section>

          <aside className="osu-right">
            <section className="osu-box">
              <h3>chart</h3>
              {bar('Constant', constantLabel(chart.internal), ((chart.internal - 1) / 14.5) * 100, color)}
              {stats.n > 0 && bar('SSS+ rate', `${stats.sssPlus} / ${stats.n}`, (stats.sssPlus / stats.n) * 100, '#6fd16f')}
              {stats.n > 0 && bar('All perfect rate', `${stats.ap} / ${stats.n}`, (stats.ap / stats.n) * 100, '#ffd24a')}
            </section>

            <section className="osu-box">
              <h3>info</h3>
              <dl className="osu-info">
                <div><dt>SSS+ rating</dt><dd>{stats.sssPlusRating} ({stats.sssPlusApRating} AP)</dd></div>
                {stats.average != null && <div><dt>average</dt><dd>{stats.average.toFixed(2)}%</dd></div>}
                {top && <div><dt>top score</dt><dd>{top.acc.toFixed(4)}%</dd></div>}
                {song.bpm ? <div><dt>BPM</dt><dd>{song.bpm}</dd></div> : null}
                {song.genre && <div><dt>genre</dt><dd>{song.genre}</dd></div>}
                {song.version && <div><dt>version</dt><dd>{song.version}</dd></div>}
              </dl>
            </section>

            <section className="osu-box">
              <h3>watch &amp; look up</h3>
              <div className="osu-links">
                {links.map((l) => (
                  <a key={l.label} className="osu-link" href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.icon === 'search' ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                    )}
                    <span>{l.label}<small>{l.sub}</small></span>
                  </a>
                ))}
              </div>
              <p className="osu-note">scores are each player&apos;s best on this site. players who hide their scores aren&apos;t listed.</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
