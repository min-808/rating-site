import type { ReactNode } from 'react';
import { CAP } from '../lib/plays-like';
import { BUCKETS_ABOVE, BUCKETS_BELOW, LOG_OFFSET, MIN_CHARTS, SPREAD_TARGET, SURE_RANGE } from '../lib/maishift-feel';
import type { WorkedExampleData } from '../lib/plays-like-worked';
import PlaysLikeFitGraph from './PlaysLikeFitGraph';

/**
 * A worked example on the "how plays like works" page (app/plays-like): every calculation of the
 * rating bucket method for one chart, laid out like a calculator. Inputs say where they come from,
 * each line shows the calculation in words, then with the numbers, and the result is highlighted.
 * One of the page's tabs. Numbers: lib/plays-like-worked.ts. No hooks.
 *
 * Each result has a colour (TONE), and wherever that number is used again it's marked in the same
 * colour, so you can see at a glance where a number comes from. Six muted tones, assigned so that
 * no two numbers in the same line share one.
 */

const RANKS = ['<94', 'AAA', 'S', 'S+', 'SS', 'SS+', 'SSS', 'SSS+', 'AP+'];
const f = (n: number, p = 2) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: p, maximumFractionDigits: p })}`;
const sg = (n: number, p = 2) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${f(Math.abs(n), p)}`;
const neg = (n: number, p = 2) => (n < 0 ? `(−${f(-n, p)})` : f(n, p));
const int = (n: number) => n.toLocaleString('en-US');

/** Each result's colour (wx-t0 ... wx-t5 in the page's css). Neighbours in one line never match. */
const TONE = {
  sss: 1, R: 2, bands: 3, N: 1, half: 2, below: 3, inRank: 4, m: 0, e: 5,
  pool: 3, l: 4, eL: 1,
  a: 1, S: 5, q: 3, s: 0, seA: 2, seS: 4,
  gap: 4, dc: 3, sample: 2, rate: 0, w: 4,
  sumW: 5, sumWdc: 1, rawDc: 0, sampleT: 2, rateT: 4, dis: 3, rawSigma: 1,
  spread: 2, scale: 5, DC: 0, sigma: 2, move: 3, candidate: 4,
} as const;
type Token = keyof typeof TONE;

/** A number used again: the same colour as where it was worked out. */
const U = ({ t, children }: { t: Token; children: ReactNode }) => <span className={`wx-use wx-t${TONE[t]}`}>{children}</span>;

function Input({ label, value, from, t }: { label: ReactNode; value: ReactNode; from: ReactNode; t?: Token }) {
  return <div className="wx-input"><span className="wx-label">{label}</span><span className="wx-value">{t ? <U t={t}>{value}</U> : value}</span><span className="wx-from">from: {from}</span></div>;
}
function Calc({ name, words, numbers, result, t }: { name: ReactNode; words?: ReactNode; numbers: ReactNode; result: ReactNode; t: Token }) {
  return (
    <div className="wx-calc">
      <div className="wx-name">{name}</div>
      {words && <div className="wx-words">= {words}</div>}
      <div className="wx-numbers">= {numbers} = <span className={`wx-result wx-t${TONE[t]}`}>{result}</span></div>
    </div>
  );
}
function Block({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return <div className="wx-step"><h4><a href={`#${step}`}>{step.replace('-', ' ')}</a> · {title}</h4>{children}</div>;
}

export default function PlaysLikeWorkedExample({ example: X }: { example: WorkedExampleData }) {
  const F = X.f;
  const b = X.bands.find((x) => x.from === X.featured)!;
  const band = `${int(b.from)}–${int(b.to)}`;
  const running = F.counts.reduce<number[]>((t, v, i) => [...t, (t[i - 1] ?? 0) + v], []);
  const k = F.mid.rank;
  const isB = (x: (typeof X.bands)[number]) => x.from === b.from;
  const leanSame = X.bands.filter((x) => Math.sign(x.dc) === Math.sign(X.rawDc)).length;
  const move = Math.max(-CAP, Math.min(CAP, X.dc));
  const twoSigma = 2 * X.sigma;
  const V = F.vtv;
  return (
    <div className="wx">
      <h3 className="wx-title">{X.title} {X.difficulty} {X.constant}{X.kind === 'uncertain' && <span className="wx-uncertain">example of an uncertain result</span>}</h3>
      {X.kind === 'uncertain' && (
        <p className="wx-uncertain-note">
          this chart clearly plays harder, but its 95% range ({X.low}–{X.high}) reaches more than {SURE_RANGE} either side, so the song page shows its plays like marked <b>uncertain</b>.
          its buckets don&apos;t agree on how much harder. everything is worked out the same way; step 10 shows where it&apos;s decided.
        </p>
      )}
      <p className="wx-intro">
        the bucket that counts most ({band}) is worked through in full; the other buckets go through the same steps, and their numbers are in the table after step 7.
        maishift&apos;s data from {X.fetched}. <span className="wx-result wx-t0">filled</span> numbers are results; when a result is used again it&apos;s
        {' '}<span className="wx-use wx-t0">underlined in the same colour</span>. each input says where it comes from.
      </p>

      <Block step="step-1" title="pick the buckets">
        <Input label="constant" value={X.constant} from="the song list" />
        <Calc t="sss" name="SSS+ rating" words={<>floor(constant &times; 22.4 &times; 100.5 &divide; 100)</>} numbers={<>floor({X.constant} &times; 22.4 &times; 1.005) = floor({f(X.constant * 22.4 * 1.005, 3)})</>} result={X.sssRating} />
        <Calc t="R" name="center rating" words={<>SSS+ rating &times; 50, at most 16,600</>} numbers={<><U t="sss">{X.sssRating}</U> &times; 50</>} result={int(X.R)} />
        <Calc t="bands" name="rating buckets" words={<>every maishift bucket from {BUCKETS_BELOW} groups of 250 under the center rating&apos;s group to {BUCKETS_ABOVE} over it, that has this chart</>}
          numbers={<><U t="R">{int(X.R)}</U> is in {int(X.groupFrom)}–{int(X.groupFrom + 249)}; {int(X.groupFrom - BUCKETS_BELOW * 250)} to {int(X.groupFrom + BUCKETS_ABOVE * 250 + 249)}</>}
          result={`${int(X.bands[0].from)}–${int(X.bands[X.bands.length - 1].to)}, ${X.bands.length} buckets`} />
      </Block>

      <Block step="step-2" title={`middle score (bucket ${band})`}>
        <div className="wx-counts">
          <table>
            <thead><tr><th>rank</th>{RANKS.map((r) => <th key={r}>{r}</th>)}</tr></thead>
            <tbody>
              <tr><th>players</th>{F.counts.map((v, i) => <td key={i}>{i === k ? <U t="inRank">{v}</U> : v}</td>)}</tr>
              <tr><th>running total</th>{running.map((v, i) => <td key={i} className={i === k ? 'wx-hit' : undefined}>{i === k - 1 ? <U t="below">{v}</U> : v}</td>)}</tr>
            </tbody>
          </table>
          <span className="wx-from">from: maishift&apos;s rank counts for this chart in bucket {band}</span>
        </div>
        <Calc t="N" name="players" words="every rank count added up" numbers={F.counts.join(' + ')} result={F.mid.total} />
        <Calc t="half" name="middle player's place" words="players ÷ 2" numbers={<><U t="N">{F.mid.total}</U> &divide; 2</>} result={F.mid.half} />
        <Calc t="below" name="middle player's rank" words={<>the first rank where the running total reaches the middle place</>}
          numbers={<>below <U t="half">{F.mid.half}</U> up to {RANKS[k - 1]}: <U t="below">{F.mid.below}</U>; {RANKS[k]} adds <U t="inRank">{F.mid.inRank}</U></>} result={`${RANKS[k]} (${F.mid.low}–${F.mid.high}%), ${F.mid.below} below`} />
        <Calc t="m" name="middle score" words={<>low end + (middle place &minus; players below) &divide; players in the rank &times; (high end &minus; low end)</>}
          numbers={<>{F.mid.low} + (<U t="half">{F.mid.half}</U> &minus; <U t="below">{F.mid.below}</U>) &divide; <U t="inRank">{F.mid.inRank}</U> &times; ({F.mid.high} &minus; {F.mid.low})</>} result={`${f(F.mid.middle, 3)}%`} />
        <Calc t="e" name="middle score's error" words={<>rank width &times; &radic;players &divide; (2 &times; players in the rank): how far the middle score could move with other players</>}
          numbers={<>{f(Math.max(F.mid.high - F.mid.low, 0.5), 1)} &times; &radic;<U t="N">{F.mid.total}</U> &divide; (2 &times; <U t="inRank">{F.mid.inRank}</U>)</>} result={`${f(F.mid.error, 3)}%`} />
      </Block>

      <Block step="step-3" title="comparison pool">
        <Input label="group of versions" value={X.era} from={`this chart's version (${X.version})`} />
        <Input label="constants" value={`${X.poolFrom} to ${X.poolTo}`} from={`${X.constant} ± 0.5`} />
        <Calc t="pool" name="comparison charts" words={<>every chart from {X.era}, from {X.poolFrom} to {X.poolTo}, with players in bucket {band}, this one left out</>} numbers={<>counted in maishift&apos;s data (at least {MIN_CHARTS} needed)</>} result={`${F.pool} charts`} />
      </Block>

      <Block step="step-4" title="log gap">
        <Calc t="l" name="log gap" words={<>ln(101 &minus; middle score + {LOG_OFFSET}): how far the middle score is from 101%, on a log scale (smaller is better)</>}
          numbers={<>ln(101 &minus; <U t="m">{f(F.mid.middle, 3)}</U> + {LOG_OFFSET}) = ln({f(101 - F.mid.middle + LOG_OFFSET, 4)})</>} result={f(b.logGap, 4)} />
        <Calc t="eL" name="log gap's error" words={<>middle score&apos;s error &divide; (101 &minus; middle score + {LOG_OFFSET})</>}
          numbers={<><U t="e">{f(F.mid.error, 3)}</U> &divide; {f(101 - F.mid.middle + LOG_OFFSET, 4)}</>} result={f(b.logGapError, 4)} />
        <p className="wx-note">every comparison chart&apos;s middle score is turned into a log gap the same way before step 5. near 101% a small step in score is a big step in log gap, which matches how much harder the top end is.</p>
      </Block>

      <Block step="step-5" title="fit the typical line">
        <PlaysLikeFitGraph example={X} />
        <p className="wx-note">for each of the <U t="pool">{F.pool}</U> comparison charts: its constant difference, that squared, and its log gap (step 4). three of them:</p>
        <div className="wx-counts">
          <table>
            <thead><tr><th>chart</th><th>constant</th><th>difference</th><th>difference&sup2;</th><th>players</th><th>middle score</th><th>log gap</th></tr></thead>
            <tbody>
              {F.samples.map((r) => (
                <tr key={`${r.title}${r.d}`}><td>{r.title} {r.difficulty}</td><td>{r.constant}</td><td>{r.d ? sg(r.d, 1) : '0.0'}</td><td>{f(r.d * r.d)}</td><td>{r.n}</td><td>{f(r.middle)}%</td><td>{f(r.logGap, 3)}</td></tr>
              ))}
            </tbody>
          </table>
          <span className="wx-from">from: maishift (players, rank counts) and the constants they&apos;re filed under</span>
        </div>
        <p className="wx-note">the sums the three equations use (every chart&apos;s values multiplied as shown, then added up):</p>
        <div className="wx-counts">
          <table>
            <tbody>
              <tr><th>charts</th><td><U t="pool">{f(V[0][0], 0)}</U></td><th>Σ difference</th><td>{f(V[0][1], 2)}</td><th>Σ difference&sup2;</th><td>{f(V[0][2], 2)}</td></tr>
              <tr><th>Σ difference&sup3;</th><td>{f(V[1][2], 3)}</td><th>Σ difference&#8308;</th><td>{f(V[2][2], 4)}</td><th>Σ log gap</th><td>{f(F.vty[0], 3)}</td></tr>
              <tr><th>Σ difference &times; log gap</th><td>{f(F.vty[1], 3)}</td><th>Σ difference&sup2; &times; log gap</th><td>{f(F.vty[2], 3)}</td><td colSpan={2} /></tr>
            </tbody>
          </table>
        </div>
        <div className="wx-calc">
          <div className="wx-name">solve the three equations</div>
          <div className="wx-words">= the values that make the line miss the log gaps least (the equations: <a href="#step-5">step 5</a>)</div>
          <div className="wx-numbers">= b0, b1, b2 = <span className={`wx-result wx-t${TONE.a}`}>{f(F.b[0], 3)}</span>, <span className={`wx-result wx-t${TONE.S}`}>{f(F.b[1], 3)}</span>, <span className={`wx-result wx-t${TONE.q}`}>{f(F.b[2], 3)}</span></div>
        </div>
        <Calc t="a" name="typical log gap" words="b0" numbers={<U t="a">{f(F.b[0], 3)}</U>} result={`${f(b.typical, 4)} (a score of ${f(b.typicalScore, 2)}%)`} />
        <Calc t="S" name="log gap per +1.0 constant" words="b1" numbers={<U t="S">{f(F.b[1], 3)}</U>} result={`${f(b.S, 3)} per +1.0 constant`} />
        <Calc t="q" name="bend" words={<>&minus;b2</>} numbers={<>&minus;<U t="q">{neg(F.b[2], 3)}</U></>} result={sg(b.q, 3)} />
        <Calc t="s" name="scatter" words={<>&radic;(Σ each chart&apos;s miss from the line, squared &divide; (charts &minus; 3))</>} numbers={<>&radic;({f(F.rss, 3)} &divide; (<U t="pool">{F.pool}</U> &minus; 3))</>} result={f(F.s, 3)} />
        <Calc t="seA" name="typical log gap's error" words={<>scatter &times; &radic;(the fit&apos;s first diagonal entry): how sure the line&apos;s height at {X.constant} is</>} numbers={<><U t="s">{f(F.s, 3)}</U> &times; &radic;{f(F.invA, 6)}</>} result={f(b.typicalError, 4)} />
        <Calc t="seS" name="rate's error" words={<>scatter &times; &radic;(the fit&apos;s second diagonal entry): how sure the log gap per +1.0 constant is</>} numbers={<><U t="s">{f(F.s, 3)}</U> &times; &radic;{f(F.invS, 6)}</>} result={f(b.SError, 4)} />
      </Block>

      <Block step="step-6" title="this chart's gap">
        <Calc t="gap" name="gap" words="typical log gap − this chart's log gap" numbers={<><U t="a">{f(b.typical, 4)}</U> &minus; <U t="l">{neg(b.logGap, 4)}</U></>} result={`${sg(b.gap, 3)} (${b.gap >= 0 ? 'better: easier' : 'worse: harder'})`} />
      </Block>

      <Block step="step-7" title="turn it into constant, and how clear it is">
        <Calc t="dc" name="constant gap" words="gap ÷ log gap per +1.0 constant" numbers={<><U t="gap">{neg(b.gap, 3)}</U> &divide; <U t="S">{f(b.S, 3)}</U></>} result={`${sg(b.dc, 3)} (${b.dc >= 0 ? 'easier' : 'harder'})`} />
        <Calc t="sample" name="sample error" words="√(log gap's error² + typical log gap's error²) ÷ log gap per +1.0 constant"
          numbers={<>&radic;(<U t="eL">{f(b.logGapError, 4)}</U>&sup2; + <U t="seA">{f(b.typicalError, 4)}</U>&sup2;) &divide; <U t="S">{f(b.S, 3)}</U></>} result={f(b.sample, 4)} />
        <Calc t="rate" name="rate error" words="|constant gap| × rate's error ÷ log gap per +1.0 constant" numbers={<><U t="dc">{f(Math.abs(b.dc), 3)}</U> &times; <U t="seS">{f(b.SError, 4)}</U> &divide; <U t="S">{f(b.S, 3)}</U></>} result={f(b.rate, 4)} />
        <Calc t="w" name="say (weight)" words="1 ÷ (sample error² + rate error²)" numbers={<>1 &divide; (<U t="sample">{f(b.sample, 4)}</U>&sup2; + <U t="rate">{f(b.rate, 4)}</U>&sup2;)</>} result={f(b.w, 1)} />
        <p className="wx-note">every bucket, through steps 2 to 7 (the bucket worked above is highlighted). high buckets, where most players are near 101%, change less per +1.0 constant, so their answers are fuzzier and their say is smaller:</p>
        <div className="wx-counts">
          <table>
            <thead><tr><th>bucket</th><th>players</th><th>middle</th><th>log gap</th><th>typical</th><th>per +1.0</th><th>gap</th><th>constant gap</th><th>sample</th><th>rate</th><th>say</th></tr></thead>
            <tbody>
              {X.bands.map((x) => isB(x) ? (
                <tr key={x.from} className="wx-hit-row">
                  <td>{int(x.from)}</td><td>{x.players}</td><td><U t="m">{f(x.middle)}%</U></td><td><U t="l">{f(x.logGap, 3)}</U></td><td><U t="a">{f(x.typical, 3)}</U></td><td><U t="S">{f(x.S)}</U></td>
                  <td><U t="gap">{sg(x.gap, 3)}</U></td><td><U t="dc">{sg(x.dc)}</U></td><td><U t="sample">{f(x.sample, 3)}</U></td><td><U t="rate">{f(x.rate, 3)}</U></td><td><U t="w">{Math.round(x.share * 100)}%</U></td>
                </tr>
              ) : (
                <tr key={x.from}>
                  <td>{int(x.from)}</td><td>{x.players}</td><td>{f(x.middle)}%</td><td>{f(x.logGap, 3)}</td><td>{f(x.typical, 3)}</td><td>{f(x.S)}</td><td>{sg(x.gap, 3)}</td><td>{sg(x.dc)}</td><td>{f(x.sample, 3)}</td><td>{f(x.rate, 3)}</td><td>{x.share < 0.01 ? '<1%' : `${Math.round(x.share * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="wx-from">say = a bucket&apos;s weight as a share of every bucket&apos;s</span>
        </div>
      </Block>

      <Block step="step-8" title="combine the buckets">
        <Calc t="sumW" name="total weight" words="every bucket's weight added up" numbers={<>{X.bands.length} buckets</>} result={f(X.sumW, 1)} />
        <Calc t="sumWdc" name="weighted gaps" words="every bucket's weight × constant gap, added up" numbers={<>&hellip; + <U t="w">{f(b.w, 1)}</U> &times; <U t="dc">{neg(b.dc, 3)}</U> + &hellip;</>} result={sg(X.sumWdc, 2)} />
        <Calc t="rawDc" name="constant gap" words="weighted gaps ÷ total weight" numbers={<><U t="sumWdc">{neg(X.sumWdc, 2)}</U> &divide; <U t="sumW">{f(X.sumW, 1)}</U></>} result={`${sg(X.rawDc, 3)} (${X.rawDc >= 0 ? 'easier' : 'harder'})`} />
        <Calc t="sampleT" name="sample part" words="1 ÷ √(Σ 1 ÷ sample error²): different players in every bucket, so these shrink together" numbers={<>1 &divide; &radic;{f(X.sumInvSample, 1)}</>} result={f(X.sample, 4)} />
        <Calc t="rateT" name="rate part" words="Σ weight × rate error ÷ total weight: every bucket's rate could be off the same way, so it isn't shrunk" numbers={<>weighted average over {X.bands.length} buckets</>} result={f(X.rate, 4)} />
        <Calc t="dis" name="disagreement" words="√(Σ weight × (bucket's gap − constant gap)² ÷ total weight ÷ (buckets − 1))" numbers={<>&radic;({f(X.sumDisagree, 3)} &divide; <U t="sumW">{f(X.sumW, 1)}</U> &divide; {X.bands.length - 1})</>} result={f(X.disagree, 4)} />
        <Calc t="rawSigma" name="uncertainty" words="√(sample part² + rate part² + disagreement²)" numbers={<>&radic;(<U t="sampleT">{f(X.sample, 4)}</U>&sup2; + <U t="rateT">{f(X.rate, 4)}</U>&sup2; + <U t="dis">{f(X.disagree, 4)}</U>&sup2;)</>} result={f(X.rawSigma, 3)} />
        <p className="wx-note">{leanSame} of {X.bands.length} buckets lean the same way ({X.rawDc >= 0 ? 'easier' : 'harder'}).</p>
      </Block>

      <Block step="step-9" title="fit to the level">
        <Input label="spread at this constant" value={X.spread == null ? 'too few charts' : f(X.spread, 3)} from={<>how widely the results of {X.spreadCharts} charts at {X.constant} vary (step 8 on each, outliers ignored)</>} t="spread" />
        <Calc t="scale" name="scale" words={<>{SPREAD_TARGET} &divide; spread, at most 1</>} numbers={<>min(1, {SPREAD_TARGET} &divide; <U t="spread">{X.spread == null ? '—' : f(X.spread, 3)}</U>{X.spread != null && <> = {f(SPREAD_TARGET / X.spread, 3)}</>})</>} result={f(X.scale, 3)} />
        <Calc t="DC" name="constant gap" words="step 8's constant gap × scale" numbers={<><U t="rawDc">{neg(X.rawDc, 3)}</U> &times; <U t="scale">{f(X.scale, 3)}</U></>} result={sg(X.dc, 3)} />
        <Calc t="sigma" name="uncertainty" words="step 8's uncertainty × scale" numbers={<><U t="rawSigma">{f(X.rawSigma, 3)}</U> &times; <U t="scale">{f(X.scale, 3)}</U></>} result={f(X.sigma, 3)} />
        <p className="wx-note">{X.scale >= 1 ? <>charts at {X.constant} already spread less than {SPREAD_TARGET}, so nothing changes here.</> : <>charts at {X.constant} spread wider than {SPREAD_TARGET}, so the result is shrunk to fit.</>}</p>
      </Block>

      <Block step="step-10" title="how sure?">
        <Calc t="move" name="move" words={<>constant gap, held between &minus;{CAP} and +{CAP}</>} numbers={<U t="DC">{sg(X.dc, 3)}</U>} result={sg(move, 3)} />
        <Calc t="candidate" name="plays like" words="constant − move, rounded to 0.1" numbers={<>{X.constant} &minus; <U t="move">{neg(move, 3)}</U> = {f(X.constant - move, 3)}</>} result={X.playsLike?.toFixed(1)} />
        <Calc t="candidate" name="95% range" words="constant − (constant gap ± 2 × uncertainty), rounded" numbers={<>{X.constant} &minus; (<U t="DC">{sg(X.dc, 3)}</U> &plusmn; 2 &times; <U t="sigma">{f(X.sigma, 3)}</U>)</>} result={`${X.low.toFixed(1)}–${X.high.toFixed(1)}`} />
        <Calc t="candidate" name="check" words={<>sure if 2 &times; uncertainty &le; {SURE_RANGE}; otherwise uncertain if |constant gap| &gt; 2 &times; uncertainty (it clearly leans one way); otherwise hidden</>}
          numbers={<>2 &times; <U t="sigma">{f(X.sigma, 3)}</U> = {f(twoSigma, 3)} {twoSigma <= SURE_RANGE ? '≤' : '>'} {SURE_RANGE}{twoSigma > SURE_RANGE && <>; |<U t="DC">{sg(X.dc, 3)}</U>| {Math.abs(X.dc) > twoSigma ? '>' : '≤'} {f(twoSigma, 3)}</>}</>}
          result={X.status === 'sure' ? `sure: plays like ${X.playsLike?.toFixed(1)}` : X.status === 'uncertain' ? `uncertain: plays like ${X.playsLike?.toFixed(1)}, marked uncertain` : 'hidden'} />
        <p className="wx-note">
          the song page shows <b>plays like {X.playsLike?.toFixed(1)} ({X.low.toFixed(1)}–{X.high.toFixed(1)})</b>{X.status === 'uncertain' && <> with an uncertain label: it plays {X.dc >= 0 ? 'easier' : 'harder'}, but the buckets don&apos;t agree enough to say exactly how much</>}.
        </p>
      </Block>
    </div>
  );
}
