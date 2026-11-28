'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { CAP, MAX_CENTER_RATING, SIGMA_MAX, SIGMA_SHOW_MAX, centerRating, type ChartFeel } from '../lib/plays-like';
import { accuracyTarget, ratingForAccuracy, ratingGroup, ratingGroupStart, RATING_GROUP_SIZE } from '../lib/comfort-level';
import { SPREAD_TARGET, SURE_RANGE, type MaishiftDetail } from '../lib/maishift-feel';
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

/** A gap in percentage points as text: -0.62 -> "-0.62%", 0.1 -> "+0.10%". */
const gapText = (gap: number) => `${gap > 0 ? '+' : ''}${gap.toFixed(2)}%`;

/**
 * The "how it plays" box: what the chart plays like compared with its constant, and the
 * average gap of each rating group (lib/plays-like.ts). Groups only, never names. Before
 * enough players count, it says how many more it needs.
 */
/**
 * The rating this chart suits: the one where it sits right at a player's comfort level, the
 * same center rating "plays like" uses (lib/plays-like.ts centerRating: an SSS+ on it x 50,
 * at most 16,600). The one from "plays like" is highlighted; the one from the constant is
 * plain, for comparison. Without a "plays like" yet, just the constant's.
 */
/** The rating groups the accuracy picker offers: 10,000–10,249 up to 16,500–16,749. */
const PICKER_GROUPS = Array.from({ length: 27 }, (_, i) => ratingGroup(10_000) + i);

/** The scores the "by accuracy" side of the picker offers: each rank's lowest score. */
const PICKER_ACCURACIES = [
  { rank: 'S', achievement: 97 }, { rank: 'S+', achievement: 98 }, { rank: 'SS', achievement: 99 },
  { rank: 'SS+', achievement: 99.5 }, { rank: 'SSS', achievement: 100 }, { rank: 'SSS+', achievement: 100.5 },
];

/**
 * Accuracy and rating on this chart, both ways round, with a toggle:
 *   by rating: pick a rating (the signed-in player's own, or any 250-wide group), get the
 *     accuracy that makes this chart worth that rating's average best-50 chart (accuracyTarget)
 *   by accuracy: pick a rank, get the rating whose average best-50 chart that score here
 *     is worth (ratingForAccuracy)
 * Both use the chart's real constant and the game's own rating formula.
 */
function AccuracyTarget({ constant, myRating }: { constant: number; myRating: number | null }) {
  const fmt = (n: number) => n.toLocaleString('en-US');
  const [mode, setMode] = useState<'rating' | 'accuracy'>('rating');
  const [picked, setPicked] = useState<string | null>(null); // "me", or a group number; null: not chosen yet
  const [pickedAccuracy, setPickedAccuracy] = useState(100); // SSS
  const choice = picked ?? (myRating != null ? 'me' : String(ratingGroup(centerRating(constant))));
  const rating = choice === 'me' && myRating != null
    ? myRating
    : ratingGroupStart(Number(choice)) + RATING_GROUP_SIZE / 2; // a group: its middle
  const target = accuracyTarget(constant, rating);
  const suits = ratingForAccuracy(constant, pickedAccuracy);

  return (
    <div className="song-feel-target">
      <div className="song-feel-target-toggle" role="group" aria-label="aim by">
        <button type="button" className={mode === 'rating' ? 'is-on' : undefined} aria-pressed={mode === 'rating'} onClick={() => setMode('rating')}>by rating</button>
        <button type="button" className={mode === 'accuracy' ? 'is-on' : undefined} aria-pressed={mode === 'accuracy'} onClick={() => setMode('accuracy')}>by accuracy</button>
      </div>

      {mode === 'rating' ? (
        <>
          <label className="song-feel-target-pick">
            <span>aim for at</span>
            <select value={choice} onChange={(event) => setPicked(event.target.value)}>
              {myRating != null && <option value="me">your rating ({fmt(myRating)})</option>}
              {PICKER_GROUPS.map((g) => (
                <option key={g} value={g}>{fmt(ratingGroupStart(g))}–{fmt(ratingGroupStart(g) + RATING_GROUP_SIZE - 1)}</option>
              ))}
            </select>
          </label>
          {'achievement' in target ? (
            <div className="song-feel-target-result">
              <b>{target.achievement.toFixed(2)}%</b>
              <small>{target.rank}</small>
            </div>
          ) : (
            <div className="song-feel-target-result is-short">
              <b>SSS+ falls short</b>
              <small>below this rating</small>
            </div>
          )}
        </>
      ) : (
        <>
          <label className="song-feel-target-pick">
            <select value={pickedAccuracy} onChange={(event) => setPickedAccuracy(Number(event.target.value))}>
              {PICKER_ACCURACIES.map((a) => (
                <option key={a.rank} value={a.achievement}>{a.rank} ({a.achievement.toFixed(1)}%)</option>
              ))}
            </select>
            <span>here →</span>
          </label>
          <div className="song-feel-target-result">
            <b>{fmt(suits.rating)}</b>
            <small>rating</small>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * "how is this worked out?" in plain words, with one rating band worked through as the example
 * (the band that counts most). Each step links to its detailed version on the "how plays like
 * works" page (app/plays-like), which has every formula, source and worked example.
 */
function SimpleHow({ feel, constant }: { feel?: ChartFeel; constant: number }) {
  // a link to the step on the "how plays like works" page (app/plays-like)
  const Step = ({ id, children }: { id: string; children: React.ReactNode }) => <Link className="song-feel-step-link" href={`/plays-like#${id}`}>{children}</Link>;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const two = (n: number) => Math.abs(n).toFixed(2);
  const easier = (n: number) => (n >= 0 ? 'easier' : 'harder');
  const move = (dc: number) => Math.max(-CAP, Math.min(CAP, dc));
  const result = (dc: number) => feel?.playsLike != null
    ? <>{constantLabel(constant)} {move(dc) >= 0 ? '−' : '+'} {two(move(dc))}{Math.abs(dc) > CAP ? ` (capped at ${CAP})` : ''} = <b>plays like {constantLabel(feel.playsLike)}</b>{feel.unsure && <>, marked <span className="song-feel-uncertain">uncertain</span> because it&apos;s give or take more than {SIGMA_MAX}</>}</>
    : <>give or take more than {SIGMA_SHOW_MAX}, too unsure to show</>;

  if (feel?.source === 'maishift' && feel.maishift) {
    const d = feel.maishift;
    const ex = d.bands.reduce((best, b) => (b.weight > best.weight ? b : best));
    const range = <>{constantLabel(d.low)}–{constantLabel(d.high)}</>;
    return (
      <>
      <p>worked out by the rating bucket method, from maishift&apos;s data:</p>
      <ol>
        <li><b>who:</b> {fmt(feel.counted)} maishift players rated {fmt(feel.ratingFrom)}–{fmt(feel.ratingTo)}, around what an SSS+ on this chart is worth, in {d.bands.length} rating buckets. <Step id="step-1">step 1</Step></li>
        <li><b>how they do:</b> in each bucket, the score of the middle player, worked out from how many players got each rank, then measured as how far it is from 101% on a log scale, so a step near the top (100.2% to 100.5%) counts for as much as it takes to get there. <Step id="step-2">step 2</Step>, <Step id="step-4">step 4</Step></li>
        <li><b>what&apos;s typical:</b> a best-fit line through every chart from {d.era} with a constant from {constantLabel(feel.baselineFrom)} to {constantLabel(feel.baselineTo)}: what a typical {constantLabel(constant)} scores, and how much scores drop per +1.0 constant. <Step id="step-3">step 3</Step>, <Step id="step-5">step 5</Step></li>
        <li><b>example, players rated {fmt(ex.from)}–{fmt(ex.to)}</b> (the bucket with the most say, {Math.round(ex.weight * 100)}%): this chart&apos;s middle score is {ex.middle.toFixed(2)}% and a typical {constantLabel(constant)} gets {ex.typicalScore.toFixed(2)}%.{typeof ex.logGap === 'number' && <> on the log scale that&apos;s {ex.logGap.toFixed(3)} against {ex.typicalLogGap.toFixed(3)}:</>} {two(ex.gap)} {ex.gap >= 0 ? 'better' : 'worse'}. typical charts there move {ex.perConstant.toFixed(2)} per +1.0 constant, so {two(ex.gap)} &divide; {ex.perConstant.toFixed(2)} = {two(ex.dc)} constant {easier(ex.dc)}. <Step id="step-6">step 6</Step>, <Step id="step-7">step 7</Step></li>
        <li><b>every bucket together:</b> each bucket counts as much as its evidence allows (enough players, scores that change with constant): {two(d.rawDc)} constant {easier(d.rawDc)}. <Step id="step-8">step 8</Step></li>
        {d.scale < 1 && <li><b>fit to the level:</b> charts at {constantLabel(constant)} spread {d.spread?.toFixed(2)} apart, more than the {SPREAD_TARGET} the site expects (each step in constant is felt, and charts within one feel at most about 0.3 to 0.5 apart), so it&apos;s scaled by {d.scale.toFixed(2)}: {two(d.dc)} constant {easier(d.dc)}. <Step id="step-9">step 9</Step></li>}
        <li><b>how sure:</b> 95% range {range}{d.status === 'sure' ? <>, within {SURE_RANGE} either side: sure</> : d.status === 'uncertain' ? <>: wider than {SURE_RANGE} either side but clearly {easier(d.dc)}, so marked <span className="song-feel-uncertain">uncertain</span></> : <>: it can&apos;t tell which way this chart leans, so it isn&apos;t shown</>}. {feel.playsLike != null && <>{constantLabel(constant)} {move(d.dc) >= 0 ? '−' : '+'} {two(move(d.dc))}{Math.abs(d.dc) > CAP ? ` (capped at ${CAP})` : ''} = <b>plays like {constantLabel(feel.playsLike)}</b>. </>}<Step id="step-10">step 10</Step></li>
      </ol>
      <p><b>the bars:</b> one row per rating bucket. the bar is this chart&apos;s middle score, the white mark is a typical {constantLabel(constant)} (both from 94% to 101%), the number after it is how much easier (+) or harder (−) that bucket says the chart is, in constant, and the last number is that bucket&apos;s say in the result. <Step id="step-7">step 7</Step></p>
      </>
    );
  }
  const w = feel?.working;
  if (!feel || !w) return <p>this chart doesn&apos;t have enough scores yet to say how it plays.</p>;
  return (
    <>
    <p>maishift has no numbers for this chart yet, so this uses this site&apos;s own players instead: each player&apos;s saved score here against their own usual score, so it doesn&apos;t matter who happened to play it.</p>
    <ol>
      <li><b>who:</b> {feel.counted} of this site&apos;s players rated {fmt(feel.ratingFrom)}–{fmt(feel.ratingTo)} with scores on other charts near {constantLabel(constant)}.</li>
      <li><b>each player against themselves:</b> their score here minus their usual score on charts within 0.2 of {constantLabel(constant)}. on average: {w.averageGap >= 0 ? '+' : '−'}{two(w.averageGap)}%.</li>
      <li><b>what&apos;s typical:</b> on the {w.comparisonCharts} similar {w.comparisonEra} charts, players beat their usual score by {w.comparisonMean >= 0 ? '+' : '−'}{two(w.comparisonMean)}% on average, so this chart is {two(w.gap)}% {w.gap >= 0 ? 'better' : 'worse'} than typical (with popularity evened out).</li>
      <li><b>in constant:</b> these players&apos; usual scores drop {w.perConstant.toFixed(2)}% per +1.0 constant, so {two(w.gap)} &divide; {w.perConstant.toFixed(2)} = {two(w.dc)} constant {easier(w.dc)}, give or take {w.sigma.toFixed(2)}.</li>
      <li><b>result:</b> {result(w.dc)}.</li>
    </ol>
    <p>the rating bucket method, which most charts use, is explained in full on <Link href="/plays-like">how plays like works</Link>.</p>
    </>
  );
}

/**
 * "how is this worked out?": the steps behind "plays like", the recommended rating and the
 * accuracy to aim for, with this chart's own numbers (lib/plays-like.ts, lib/comfort-level.ts).
 * The browser's own <dialog>: Esc or a click outside closes it.
 */
function HowItWorks({ feel, constant }: { feel?: ChartFeel; constant: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <>
      <button type="button" className="song-feel-how" onClick={() => ref.current?.showModal()}>how is this worked out?</button>
      <dialog ref={ref} className="song-feel-dialog" aria-label="how plays like is worked out"
        onClick={(event) => { if (event.target === ref.current) ref.current?.close(); }}>
        <div className="song-feel-dialog-body">
          <button type="button" className="song-feel-dialog-x" onClick={() => ref.current?.close()} aria-label="close">×</button>
          <h4>how &ldquo;plays like&rdquo; is worked out</h4>
          <SimpleHow feel={feel} constant={constant} />
          <p className="song-feel-dialog-more"><Link href="/plays-like">every step in detail, with formulas and worked examples &rarr;</Link></p>
          <h4>rating</h4>
          <p>what an SSS+ on the chart is worth &times; 50 (a rating is 50 charts), using the game&apos;s rounding, at most {fmt(MAX_CENTER_RATING)}. if every chart in your best 50 were worth that much, that would be your rating, so this chart is one to push on while you&apos;re working toward it. players already at that rating usually score a rank or so under SSS+ on it. here: {fmt(centerRating(constant))} from the constant{feel?.playsLike != null && <>, {fmt(centerRating(feel.playsLike))} from plays like</>}.</p>
          <h4>accuracy to aim for</h4>
          <p><b>by rating:</b> the lowest score that makes this chart worth as much as the average chart in that rating&apos;s best 50 (rating &divide; 50). <b>by accuracy:</b> the other way round: the rating that score helps you reach. both use the chart&apos;s real constant, since that&apos;s what the game rates.</p>
        </div>
      </dialog>
    </>
  );
}

function RecommendedRating({ playsLike, constant, myRating, uncertain = false }: { playsLike: number | null; constant: number; myRating: number | null; uncertain?: boolean }) {
  const fmt = (n: number) => n.toLocaleString('en-US');
  return (
    <div className="song-feel-recommend">
      <span className="song-feel-recommend-label">rating</span>
      {playsLike != null && (
        <div className="song-feel-recommend-main">
          <b>{fmt(centerRating(playsLike))}</b>
          <small>plays like {constantLabel(playsLike)}{uncertain && <> <span className="song-feel-uncertain">uncertain</span></>}</small>
        </div>
      )}
      <div className={playsLike != null ? 'song-feel-recommend-plain' : 'song-feel-recommend-main'}>
        {playsLike != null ? <span>{fmt(centerRating(constant))}</span> : <b>{fmt(centerRating(constant))}</b>}
        <small>constant {constantLabel(constant)}</small>
      </div>
      <AccuracyTarget constant={constant} myRating={myRating} />
    </div>
  );
}

/**
 * The rating bucket method's numbers, one row per bucket: players, this chart's middle score
 * against a typical chart's at this constant, what that bucket says in constant (+ easier), and
 * the bucket's say: the same numbers the calculation uses (lib/maishift-feel.ts), plus the credit
 * maishift asks for.
 */
const DIST_FLOOR = 94; // the bars run from 94% (AAA) to 101%
function MaishiftBreakdown({ detail, constant, players }: { detail: MaishiftDetail; constant: number; players: number }) {
  const fmt = (n: number) => n.toLocaleString('en-US');
  const at = (score: number) => `${Math.max(0, Math.min(100, ((score - DIST_FLOOR) / (101 - DIST_FLOOR)) * 100))}%`;
  const higher = detail.bands.filter((b) => b.gap > 0).length;
  const first = detail.bands[0];
  const last = detail.bands[detail.bands.length - 1];
  return (
    <div className="song-dist">
      <p className="song-dist-summary">
        middle score vs a typical {constantLabel(constant)}: higher in {higher} of {detail.bands.length} rating bucket{detail.bands.length === 1 ? '' : 's'}
      </p>
      <div className="song-dist-row is-head">
        <span>rating</span><span>players</span><span>middle score <i className="song-dist-key" /> this chart <i className="song-dist-key is-typical" /> typical</span><span />
      </div>
      {detail.bands.map((band) => (
        <div className="song-dist-row" key={band.from}>
          <span>{fmt(band.from)}</span>
          <span>{fmt(band.players)}</span>
          <span className="song-dist-track" title={`this chart ${band.middle.toFixed(2)}%, typical ${band.typicalScore.toFixed(2)}%, ${band.dc >= 0 ? '+' : '−'}${Math.abs(band.dc).toFixed(2)} constant, say ${Math.round(band.weight * 100)}%`}>
            <span className="song-dist-fill" style={{ width: at(band.middle) }} />
            <span className="song-dist-marker" style={{ left: at(band.typicalScore) }} />
          </span>
          <span className={band.gap > 0 ? 'is-easier' : band.gap < 0 ? 'is-harder' : undefined}>
            <b>{band.middle.toFixed(2)}%</b> {band.dc > 0 ? '+' : band.dc < 0 ? '−' : ''}{Math.abs(band.dc).toFixed(2)}
            {' '}<small title="this bucket's say in the result">{band.weight < 0.01 ? '<1' : Math.round(band.weight * 100)}%</small>
          </span>
        </div>
      ))}
      <p className="song-details-note">
        data: <a href="https://maimai.shiftpsh.com" target="_blank" rel="noopener noreferrer">maishift</a>, {fmt(players)} players rated {fmt(first.from)}–{fmt(last.to)}, fetched {new Date(detail.fetchedAt).toLocaleDateString('en-CA')} · unofficial, not affiliated with SEGA
      </p>
    </div>
  );
}

function ChartFeelBox({ feel, constant, myRating }: { feel?: ChartFeel; constant: number; myRating: number | null }) {
  if (!feel || feel.playsLike == null) {
    const rangeText = feel ? `${feel.ratingFrom.toLocaleString('en-US')}–${feel.ratingTo.toLocaleString('en-US')}` : '';
    return (
      <section className="song-details-box">
        <h3>how it plays</h3>
        {feel && (
          <p className="song-feel-empty">
            {feel.unsure && feel.source === 'maishift' && feel.maishift
              ? `too close to call: it can't tell which way this chart leans against others at ${constantLabel(constant)} (likely ${constantLabel(feel.maishift.low)}–${constantLabel(feel.maishift.high)})`
              : feel.unsure
              ? `too close to call: the scores can't tell this chart apart from others at ${constantLabel(constant)} (give or take ${feel.sigma?.toFixed(2)}, more than ${SIGMA_SHOW_MAX})`
              : feel.counted === 0
              ? `no scores yet from players${feel.allRatings ? '' : ` rated ${rangeText}`}`
              : `not enough scores yet: ${feel.counted} of ${feel.needed} players${feel.allRatings ? '' : ` rated ${rangeText}`}`}
          </p>
        )}
        <RecommendedRating playsLike={null} constant={constant} myRating={myRating} />
        <HowItWorks feel={feel} constant={constant} />
      </section>
    );
  }

  const rangeText = `${feel.ratingFrom.toLocaleString('en-US')}–${feel.ratingTo.toLocaleString('en-US')}`;
  const offset = Math.round((feel.playsLike - constant) * 10) / 10;
  const verdict = offset >= 0.1 ? 'harder than' : offset <= -0.1 ? 'easier than' : 'about right for';
  const verdictClass = offset >= 0.1 ? ' is-harder' : offset <= -0.1 ? ' is-easier' : '';
  // the bars share one scale: the biggest gap reaches the edge (at least 1%, so small gaps stay small)
  const scale = Math.max(1, ...feel.groups.map((g) => Math.abs(g.averageGap)));

  return (
    <section className="song-details-box">
      <h3>how it plays</h3>
      <div className="song-feel-headline">
        <span>plays like</span>
        <b className={`song-feel-constant${verdictClass}${feel.unsure ? ' is-uncertain' : ''}`}>{constantLabel(feel.playsLike)}</b>
        <small>{verdict} its {constantLabel(constant)}</small>
        {feel.unsure && <span className="song-feel-uncertain" title={feel.playsLikeLow != null ? `likely ${constantLabel(feel.playsLikeLow)}–${constantLabel(feel.playsLikeHigh ?? feel.playsLike)}: wider than ${SURE_RANGE} either side` : `give or take ${feel.sigma?.toFixed(3)}: more than ${SIGMA_MAX}, so this may be off`}>uncertain</span>}
      </div>
      {feel.playsLikeLow != null && feel.playsLikeHigh != null && (
        <p className="song-details-note">likely {constantLabel(feel.playsLikeLow)}–{constantLabel(feel.playsLikeHigh)} (95% range)</p>
      )}
      {/* sigma between SIGMA_MAX and SIGMA_SHOW_MAX: shown, but say how unsure (lib/plays-like.ts) */}
      {feel.unsure && (
        <p className="song-feel-uncertain-note">
          {feel.source === 'maishift'
            ? <>uncertain: it clearly plays {offset > 0 ? 'harder' : 'easier'}, but the 95% range reaches more than {SURE_RANGE} either side, so treat this as a lean, not a number</>
            : <>uncertain: give or take {feel.sigma?.toFixed(3)} constant (sure results are within {SIGMA_MAX}). the charts it&apos;s compared with vary a lot, so treat this as a lean, not a number</>}
        </p>
      )}

      <RecommendedRating playsLike={feel.playsLike} constant={constant} myRating={myRating} uncertain={feel.unsure} />

      {/* fewer than MIN_PLAYERS: still shown, but say it's only a few players (lib/plays-like.ts) */}
      {feel.lowSample && (
        <p className="song-feel-warning">
          based on only {feel.counted} player{feel.counted === 1 ? '' : 's'} (fewer than {feel.needed}), so this may be inaccurate
        </p>
      )}

      {feel.source === 'maishift' && feel.maishift ? (
        <MaishiftBreakdown detail={feel.maishift} constant={constant} players={feel.counted} />
      ) : (<>
      {/* each rating group's average gap: left (orange) scored below their usual, right (blue) above */}
      <div className="song-feel-groups">
        {feel.groups.map((group) => {
          const width = (Math.abs(group.averageGap) / scale) * 50;
          return (
            <div className="song-feel-group" key={group.from}>
              <div className="song-feel-group-label">
                <span>{group.from.toLocaleString('en-US')}–{group.to.toLocaleString('en-US')} <small>· {group.players}</small></span>
                <span>{gapText(group.averageGap)}</span>
              </div>
              <div className="song-feel-track">
                <div
                  className={`song-feel-fill${group.averageGap < 0 ? ' is-below' : ' is-above'}`}
                  style={group.averageGap < 0 ? { right: '50%', width: `${width}%` } : { left: '50%', width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="song-details-note">
        where this comes from: {feel.counted} of this site&apos;s players{feel.allRatings ? '' : ` rated ${rangeText}`}, each player&apos;s score here compared with
        their own usual score on {constantLabel(feel.baselineFrom)}–{constantLabel(feel.baselineTo)} charts, then with other charts from the same era
      </p>
      </>)}
      <HowItWorks feel={feel} constant={constant} />
    </section>
  );
}

export default function SongPageView({ song, view, details }: { song: SongInfo; view: SongView; details?: SongDetails }) {
  // which chart is open ("dx-master"), and how many of its ranking rows are showing
  const [selectedChartId, setSelectedChartId] = useState(view.defaultChart);
  const [visibleRowCount, setVisibleRowCount] = useState(RANKING_ROWS_PER_PAGE);

  // the signed-in player, so their own row can be highlighted. asked from the browser, so
  // the page itself stays the same for everyone and can be cached
  const [myWebId, setMyWebId] = useState<number | null>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  useEffect(() => {
    fetchMe() // the same request the header's account button makes (components/me.ts)
      .then((me) => {
        setMyWebId(me.signedIn ? me.webId ?? null : null);
        setMyRating(me.signedIn ? me.rating ?? null : null); // for the accuracy to aim for
      })
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

            {/* how hard it plays vs its constant, from players in range (lib/plays-like.ts) */}
            <ChartFeelBox feel={selectedChart.feel} constant={selectedChart.internal} myRating={myRating} />

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
