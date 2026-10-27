import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import FallbackImage from '../../../components/FallbackImage';
import { songPagesCss } from '../../../components/song-pages-css';
import { getCatalogSong, type CatalogChart } from '../../../lib/song-catalog';
import { getSongRecords, recordsForChart } from '../../../lib/song-records';
import { songLinks } from '../../../lib/song-links';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS, constantLabel } from '../../../lib/song-browse';
import { rankFor, rateSong } from '../../../lib/song-calc';
import { rankImage, comboBadge, syncBadge } from '../../../lib/badges';
import { isGf } from '../../../lib/special-players';
import type { Song } from '../../../lib/leaderboard';

/**
 * /songs/[id]: one song, laid out like an osu! beatmap page. A banner with the jacket and
 * the song's details, a row of tabs (one per chart, easiest to hardest), and for the chosen
 * chart a leaderboard of everyone's best score next to a panel of numbers.
 *
 *   /songs/<id>                  the song's hardest chart
 *   /songs/<id>?chart=dx-master  a chart: std or dx, then the difficulty
 *
 * The leaderboard is read per song (lib/song-records.ts) and kept for 5 minutes. Players
 * who hide their scores aren't on it.
 */

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chart?: string }>;
};

const chartId = (c: Pick<CatalogChart, 'kind' | 'difficulty'>) => `${c.kind === 'dx' ? 'dx' : 'std'}-${c.difficulty}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const song = await getCatalogSong(id);
  if (!song) return { title: '404 - HI Maimai' };
  return {
    title: `${song.title} - HI Maimai`,
    description: `${song.title}${song.artist ? ` by ${song.artist}` : ''}: charts and the top scores`,
  };
}

export default async function SongPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { chart: chartParam } = await searchParams;

  const song = await getCatalogSong(id);
  if (!song) notFound();

  const all = await getSongRecords(song);

  // default tab: the hardest chart (DX first on a tie)
  const hardest = [...song.charts].sort((a, b) => (b.internal - a.internal) || (Number(b.kind === 'dx') - Number(a.kind === 'dx')))[0];
  const chart = song.charts.find((c) => chartId(c) === chartParam) ?? hardest;
  const rows = recordsForChart(all, chart.kind, chart.difficulty);

  // the side panel's numbers
  const average = rows.length ? rows.reduce((t, r) => t + r.achievement, 0) / rows.length : null;
  const apCount = rows.filter((r) => r.ap || /^ap/i.test(r.fc ?? '')).length;
  const sssPlus = rows.filter((r) => r.achievement >= 100.5).length;
  const asScore = (achievement: number, ap: boolean) =>
    rateSong({ achievement, ap, internal_difficulty: chart.internal } as Song);
  const links = songLinks({ title: song.title, artist: song.artist, kind: chart.kind, difficultyLabel: DIFFICULTY_LABELS[chart.difficulty] });

  return (
    <main className="sg-main">
      <style>{songPagesCss}</style>

      <p className="sd-crumb"><Link href="/songs">&larr; all songs</Link></p>

      <section className="sd-hero">
        {song.jacket && <div className="sd-hero-bg" style={{ backgroundImage: `url(${song.jacket})` }} aria-hidden="true" />}
        <div className="sd-hero-inner">
          {song.jacket && (
            <div className="sd-jacket"><FallbackImage src={song.jacket} alt={`${song.title} jacket`} /></div>
          )}
          <div className="sd-titles">
            <h1>{song.title}</h1>
            {song.artist && <p className="sd-artist">{song.artist}</p>}
            <div className="sd-chips">
              {song.genre && <span className="sd-chip">{song.genre}</span>}
              {song.bpm ? <span className="sd-chip">{song.bpm} BPM</span> : null}
              {song.version && <span className="sd-chip">{song.version}</span>}
              {!song.na && <span className="sd-chip warn">not in North America</span>}
            </div>
          </div>
        </div>
      </section>

      <nav className="sd-tabs" aria-label="charts">
        {song.charts.map((c) => {
          const color = DIFFICULTY_COLORS[c.difficulty];
          const active = chartId(c) === chartId(chart);
          const players = all.filter((r) => r.kind === c.kind && r.difficulty === c.difficulty).length;
          return (
            <Link
              key={chartId(c)}
              href={`/songs/${song.id}?chart=${chartId(c)}`}
              className={`sd-tab${active ? ' is-active' : ''}`}
              style={{ ['--tab-color' as string]: color }}
              aria-current={active ? 'page' : undefined}
              scroll={false}
            >
              <b><i />{c.kind === 'dx' ? 'DX' : 'STD'} {DIFFICULTY_LABELS[c.difficulty]}</b>
              <small>{constantLabel(c.internal)} &middot; {players} player{players === 1 ? '' : 's'}</small>
            </Link>
          );
        })}
      </nav>

      <div className="sd-body">
        <section className="sd-card">
          <h2>leaderboard</h2>
          {rows.length === 0 ? (
            <p className="sd-empty">no one has a score on this chart yet</p>
          ) : (
            <div className="sd-scroll">
              <table className="sd-table">
                <thead>
                  <tr>
                    <th>#</th><th>player</th><th>accuracy</th><th>combo / sync</th>
                    <th className="num">DX score</th><th className="num">rating</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const rank = rankFor(r.achievement)?.rank;
                    const combo = comboBadge({ fc: r.fc ?? undefined, ap: r.ap });
                    const sync = syncBadge({ fs: r.fs ?? undefined });
                    return (
                      <tr key={r.webId}>
                        <td className={`sd-pos${i < 3 ? ` p${i + 1}` : ''}`}>{i + 1}</td>
                        <td>
                          <Link href={`/user/${r.webId}`} className={`sd-player${isGf(r.userId) ? ' gf-name' : ''}`}>
                            {(r.pfpBlob || r.pfp) && <FallbackImage src={r.pfpBlob ?? undefined} fallbackSrc={r.pfp ?? undefined} alt="" className="sd-avatar" width={26} height={26} />}
                            {r.name}
                          </Link>
                        </td>
                        <td>
                          <span className="sd-acc">
                            {rank && <img src={rankImage(rank)} alt={rank} />}
                            {r.achievement.toFixed(4)}%
                          </span>
                        </td>
                        <td>
                          <span className="sd-badges">
                            {combo && <img src={combo.src} alt={combo.label} title={combo.label} />}
                            {sync && <img src={sync.src} alt={sync.label} title={sync.label} />}
                            {!combo && !sync && <span className="sd-dim">-</span>}
                          </span>
                        </td>
                        <td className="num">
                          {r.dxScore != null && r.dxMax ? `${r.dxScore.toLocaleString()} / ${r.dxMax.toLocaleString()}` : <span className="sd-dim">-</span>}
                        </td>
                        <td className="num">{r.rating}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="sd-side">
          <section className="sd-card">
            <h2>{chart.kind === 'dx' ? 'DX' : 'standard'} {DIFFICULTY_LABELS[chart.difficulty]}</h2>
            <dl className="sd-stats">
              <div><dt>constant</dt><dd>{constantLabel(chart.internal)}</dd></div>
              {chart.level && <div><dt>level</dt><dd>{chart.level}</dd></div>}
              <div><dt>SSS+ rating</dt><dd>{asScore(100.5, false)} <span className="sd-dim">({asScore(100.5, true)} AP)</span></dd></div>
              <div><dt>players</dt><dd>{rows.length}</dd></div>
              {average != null && <div><dt>average</dt><dd>{average.toFixed(2)}%</dd></div>}
              {rows.length > 0 && <div><dt>top score</dt><dd>{rows[0].achievement.toFixed(4)}%</dd></div>}
              {rows.length > 0 && <div><dt>SSS+</dt><dd>{sssPlus}</dd></div>}
              {rows.length > 0 && <div><dt>all perfect</dt><dd>{apCount}</dd></div>}
            </dl>
          </section>

          <section className="sd-card">
            <h2>watch &amp; look up</h2>
            <div className="sd-links">
              {links.map((l) => (
                <a key={l.label} className="sd-link" href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.icon === 'search' ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  )}
                  <span>{l.label}<small>{l.sub}</small></span>
                </a>
              ))}
            </div>
            <p className="sd-note">scores are each player&apos;s best on this site. players who hide their scores aren&apos;t listed.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
