'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Song } from '../lib/leaderboard';
import { rankFor } from '../lib/song-calc';
import { rankImage, comboBadge, syncBadge } from '../lib/badges';
import { SongDetail, bestFiftyCss, ratingGains, type Selected } from './BestFifty';

/**
 * The level summary's charts (/user/[id]/levels): a block per constant, rows inside it
 * (by grade, combo, sync or AP), jacket tiles in the rows. The page works out what goes
 * where on the server; this draws it, and opens the same score popup as the best 50
 * when a played chart is clicked.
 */

export type TileChart = {
  key: string;
  title: string;
  kind: 'dx' | 'standard';
  difficulty: string;
  internal: number;
  jacket: string | null;
  song: Song | null; // their score (with jacket, version and details filled in), null if unplayed
  info: Song; // for the popup: their score, or for an unplayed chart its details and no score
};
export type TileRow = { row: string; image: string | null; badge: boolean; charts: TileChart[] };
// total: every chart at this constant (in the chosen versions), shown or not
export type TileLevel = { constant: string; played: number; total: number; rows: TileRow[] };

const DIFF_COLOR: Record<string, string> = {
  basic: '#22a352', advanced: '#d99000', expert: '#e0403a', master: '#9b4fd1', remaster: '#b48be0',
};
const DIFF_LABEL: Record<string, string> = {
  basic: 'Basic', advanced: 'Advanced', expert: 'Expert', master: 'Master', remaster: 'Re:Master',
};

export default function LevelTiles({ levels, showRank, allScores }: {
  levels: TileLevel[];
  showRank: boolean; // the rows aren't grades, so each tile shows its rank
  allScores: Song[]; // every score they have, for the popup's "new PB: +N rating"
}) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const gains = useMemo(() => ratingGains(allScores), [allScores]);

  return (
    <>
      <style>{bestFiftyCss}</style>
      {levels.map((level) => (
        <section className="ls-group" key={level.constant} aria-label={`level ${level.constant}`}>
          <div className="ls-group-head">
            <h2>{level.constant}</h2>
            {/* every chart at this constant played: the count in yellow */}
            <span className={level.total > 0 && level.played >= level.total ? 'ls-complete' : undefined}
              title={level.total > 0 && level.played >= level.total ? 'every chart at this level played' : undefined}>
              {level.played} / {level.total} played
            </span>
          </div>
          {level.rows.map((row) => (
            <div className="ls-grade-row" key={row.row}>
              <div className="ls-grade-label" title={row.row}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {row.image ? <img src={row.image} alt={row.row} className={row.badge ? 'ls-badge-label' : undefined} /> : <span>{row.row}</span>}
              </div>
              <ul className="ls-tiles">
                {row.charts.map((c, i) => {
                  const s = c.song;
                  const combo = s ? comboBadge(s) : null;
                  const sync = s ? syncBadge(s) : null;
                  const rank = s ? rankFor(s.achievement)?.rank : null;
                  const label = `${c.title} · ${DIFF_LABEL[c.difficulty] ?? c.difficulty} ${c.kind === 'dx' ? 'DX' : 'STD'} · ${c.internal.toFixed(1)}`
                    + (s ? ` · ${s.achievement.toFixed(4)}%${combo ? ` ${combo.label}` : ''}${sync ? ` ${sync.label}` : ''}${s.source === 'jp' ? ' (japan)' : ''}` : ' · unplayed');
                  return (
                    <li key={c.key} className="ls-tile" style={{ '--diff': DIFF_COLOR[c.difficulty] ?? '#888' } as CSSProperties} title={label}>
                      <div className={s ? undefined : 'ls-unplayed'} style={{ position: 'absolute', inset: 0 }}>
                        {c.jacket ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="ls-art" src={c.jacket} alt="" loading="lazy" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="ls-noart">{c.title}</span>
                        )}
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {combo && <img className="ls-combo" src={combo.src} alt={combo.label} />}
                      {c.kind === 'dx' && <span className="ls-dx">DX</span>}
                      {s && (
                        <span className="ls-foot">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {showRank && rank && <img src={rankImage(rank)} alt={rank} />}
                          <span>{s.achievement.toFixed(2)}%</span>
                        </span>
                      )}
                      {/* opens the same popup as the best 50 (just the details, for an unplayed chart) */}
                      <button
                        type="button"
                        className="ls-open"
                        aria-label={label}
                        onClick={() => setSelected({ song: c.info, position: i + 1, list: `${level.constant} · ${row.row}`, size: row.charts.length })}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
      <SongDetail entry={selected} gains={gains} onClose={() => setSelected(null)} />
    </>
  );
}
