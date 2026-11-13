import type { ReactNode } from 'react';
import { CAP, SIGMA_MAX, SIGMA_SHOW_MAX, S_MIN } from '../lib/plays-like';
import { MIN_CHARTS } from '../lib/maishift-feel';
import type { WorkedExampleData } from '../lib/plays-like-worked';
import PlaysLikeFitGraph from './PlaysLikeFitGraph';

/**
 * A worked example on the "how plays like works" page (app/plays-like): every calculation for one
 * chart, laid out like a calculator. Inputs say where they come from, each line shows the
 * calculation in words, then with the numbers, and the result is highlighted. One of the page's
 * tabs. Numbers: lib/plays-like-worked.ts. No hooks.
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
  sss: 1, R: 2, bands: 3, N: 1, half: 2, below: 3, inRank: 4, m: 0,
  pool: 3, xbar: 4, a: 1, S: 5, q: 3, beta: 2, s: 0,
  log2n: 3, adjusted: 5, gap: 4, dc: 3, sigmaB: 2, w: 4,
  sumW: 5, sumWdc: 1, DC: 0, sigma: 2, move: 3, candidate: 4,
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
/** Several numbers joined by an operator, the featured band's in its colour. */
function Joined({ items, sep }: { items: Array<{ text: string; t?: Token }>; sep: string }) {
  return <>{items.map((x, i) => <span key={i}>{i > 0 && sep}{x.t ? <U t={x.t}>{x.text}</U> : x.text}</span>)}</>;
}

export default function PlaysLikeWorkedExample({ example: X }: { example: WorkedExampleData }) {
  const b = X.bands.find((x) => x.from_ === X.featured)!;
  const leanSame = X.bands.filter((x) => Math.sign(x.dc) === Math.sign(X.dc)).length;
  const band = `${int(b.from_)}–${int(b.to)}`;
  const running = b.counts.reduce<number[]>((t, v, i) => [...t, (t[i - 1] ?? 0) + v], []);
  const kIndex = RANKS.indexOf(b.mid.k);
  const s = b.sums;
  const groupFrom = Math.floor(X.R / 250) * 250;
  const isB = (x: (typeof X.bands)[number]) => x.from_ === b.from_;
  return (
    <div className="wx">
      <h3 className="wx-title">{X.title} {X.difficulty} {X.constant}{X.kind === 'uncertain' && <span className="wx-uncertain">example of an uncertain result</span>}</h3>
      {X.kind === 'uncertain' && (
        <p className="wx-uncertain-note">
          this chart&apos;s uncertainty comes out at {f(X.sigma, 3)}, just over the {SIGMA_MAX} a sure result needs, so the song page shows its plays like marked <b>uncertain</b>.
          everything is worked out the same way; step 9 shows where it&apos;s decided.
        </p>
      )}
      <p className="wx-intro">
        the band that counts most ({band}) is worked through in full; the other bands go through the same steps, and their numbers are in the table after step 7.
        maishift&apos;s data from {X.fetched}. <span className="wx-result wx-t0">filled</span> numbers are results; when a result is used again it&apos;s
        {' '}<span className="wx-use wx-t0">underlined in the same colour</span>. each input says where it comes from.
      </p>

      <Block step="step-1" title="pick the bands">
        <Input label="constant" value={X.constant} from="the song list" />
        <Calc t="sss" name="SSS+ rating" words={<>floor(constant &times; 22.4 &times; 100.5 &divide; 100)</>} numbers={<>floor({X.constant} &times; 22.4 &times; 1.005) = floor({f(X.constant * 22.4 * 1.005, 3)})</>} result={X.sssRating} />
        <Calc t="R" name="center rating" words={<>SSS+ rating &times; 50, at most 16,600</>} numbers={<><U t="sss">{X.sssRating}</U> &times; 50</>} result={int(X.R)} />
        <Calc t="bands" name="rating bands" words={<>the 250-wide group the center rating is in, plus 3 groups either side</>} numbers={<><U t="R">{int(X.R)}</U> is in {int(groupFrom)}–{int(groupFrom + 249)}; &plusmn; 750</>} result={`${int(X.bands[0].from_)}–${int(X.bands[X.bands.length - 1].to)}, ${X.bands.length} bands`} />
      </Block>

      <Block step="step-2" title={`middle score (band ${band})`}>
        <div className="wx-counts">
          <table>
            <thead><tr><th>rank</th>{RANKS.map((r) => <th key={r}>{r}</th>)}</tr></thead>
            <tbody>
              <tr><th>players</th>{b.counts.map((v, i) => <td key={i}>{i === kIndex ? <U t="inRank">{v}</U> : v}</td>)}</tr>
              <tr><th>running total</th>{running.map((v, i) => <td key={i} className={i === kIndex ? 'wx-hit' : undefined}>{i === kIndex - 1 ? <U t="below">{v}</U> : v}</td>)}</tr>
            </tbody>
          </table>
          <span className="wx-from">from: maishift&apos;s rank counts for this chart in band {band}</span>
        </div>
        <Calc t="N" name="players" words="every rank count added up" numbers={b.counts.join(' + ')} result={b.mid.N} />
        <Calc t="half" name="middle player's place" words="players ÷ 2" numbers={<><U t="N">{b.mid.N}</U> &divide; 2</>} result={b.mid.half} />
        <Calc t="below" name="middle player's rank" words={<>the first rank where the running total reaches the middle place</>}
          numbers={<>below <U t="half">{b.mid.half}</U> up to {RANKS[kIndex - 1]}: <U t="below">{b.mid.below}</U>; {b.mid.k} adds <U t="inRank">{b.mid.inRank}</U></>} result={`${b.mid.k} (${b.mid.L}–${b.mid.H}%), ${b.mid.below} below`} />
        <Calc t="m" name="middle score" words={<>low end + (middle place &minus; players below) &divide; players in the rank &times; (high end &minus; low end)</>}
          numbers={<>{b.mid.L} + (<U t="half">{b.mid.half}</U> &minus; <U t="below">{b.mid.below}</U>) &divide; <U t="inRank">{b.mid.inRank}</U> &times; ({b.mid.H} &minus; {b.mid.L})</>} result={`${f(b.mid.m)}%`} />
      </Block>

      <Block step="step-3" title="comparison pool">
        <Input label="era" value="FESTiVAL and later" from={`this chart's version (${X.version})`} />
        <Input label="constants" value={`${X.poolFrom} to ${X.poolTo}`} from={`${X.constant} ± 0.5`} />
        <Calc t="pool" name="comparison charts" words={<>every FESTiVAL-and-later chart from {X.poolFrom} to {X.poolTo} with players in band {band}, this one left out</>} numbers={<>counted in maishift&apos;s data (at least {MIN_CHARTS} needed)</>} result={`${b.pool} charts`} />
      </Block>

      <Block step="step-4" title="fit the typical curve">
        <PlaysLikeFitGraph example={X} />
        <p className="wx-note">for each of the <U t="pool">{b.pool}</U> comparison charts: its constant difference, that squared, its popularity, and its middle score (step 2 on its own rank counts). three of them:</p>
        <div className="wx-counts">
          <table>
            <thead><tr><th>chart</th><th>constant</th><th>constant difference</th><th>difference&sup2;</th><th>players</th><th>popularity</th><th>middle score</th></tr></thead>
            <tbody>
              {X.samples.map((r) => (
                <tr key={r.title}><td>{r.title} {r.difficulty}</td><td>{r.constant}</td><td>{r.d ? sg(r.d, 1) : '0.0'}</td><td>{f(r.d2)}</td><td>{r.n}</td><td>{sg(r.x, 3)}</td><td>{f(r.m)}%</td></tr>
              ))}
            </tbody>
          </table>
          <span className="wx-from">from: maishift (players, rank counts) and the constants they&apos;re filed under; popularity = log&#8322; players &minus; the pool&apos;s average</span>
        </div>
        <Calc t="xbar" name="average popularity" words={<>average of log&#8322; players over the comparison charts</>} numbers={<>(log&#8322; of each chart&apos;s players, added up) &divide; <U t="pool">{b.pool}</U></>} result={`${f(b.xbar, 3)} (about ${Math.round(2 ** b.xbar)} players)`} />
        <p className="wx-note">the 13 sums the four equations use (every chart&apos;s values multiplied as shown, then added up):</p>
        <div className="wx-counts">
          <table>
            <tbody>
              <tr><th>charts</th><td><U t="pool">{s.N}</U></td><th>Σ difference</th><td>{f(s.d, 2)}</td><th>Σ difference&sup2;</th><td>{f(s.d2, 2)}</td><th>Σ difference&sup3;</th><td>{f(s.d3, 3)}</td></tr>
              <tr><th>Σ difference&#8308;</th><td>{f(s.d4, 4)}</td><th>Σ popularity</th><td>{f(Math.abs(s.x), 1)}</td><th>Σ popularity &times; difference</th><td>{f(s.xd, 3)}</td><th>Σ popularity &times; difference&sup2;</th><td>{f(s.xd2, 3)}</td></tr>
              <tr><th>Σ popularity&sup2;</th><td>{f(s.x2, 3)}</td><th>Σ middle score</th><td>{f(s.m, 2)}</td><th>Σ difference &times; middle</th><td>{f(s.dm, 2)}</td><th>Σ difference&sup2; &times; middle</th><td>{f(s.d2m, 2)}</td></tr>
              <tr><th>Σ popularity &times; middle</th><td>{f(s.xm, 2)}</td><td colSpan={6} /></tr>
            </tbody>
          </table>
        </div>
        <div className="wx-calc">
          <div className="wx-name">solve the four equations</div>
          <div className="wx-words">= the values that make the curve miss the middle scores least (the equations: <a href="#step-4">step 4</a>)</div>
          <div className="wx-numbers">= b0, b1, b2, b3 = <span className={`wx-result wx-t${TONE.a}`}>{f(b.b[0], 3)}</span>, <span className={`wx-result wx-t${TONE.S}`}>{f(b.b[1], 3)}</span>, <span className={`wx-result wx-t${TONE.q}`}>{f(b.b[2], 3)}</span>, <span className={`wx-result wx-t${TONE.beta}`}>{f(b.b[3], 3)}</span></div>
        </div>
        <Calc t="a" name="typical score" words="b0" numbers={<U t="a">{f(b.b[0], 3)}</U>} result={`${f(b.a)}%`} />
        <Calc t="S" name="accuracy per +1.0 constant" words={<>&minus;b1, at least {S_MIN}</>} numbers={<>&minus;<U t="S">{neg(b.b[1], 3)}</U></>} result={`${f(b.S)}% per +1.0 constant`} />
        <Calc t="q" name="bend" words={<>b2 (positive: the drop slows on the hard side; negative: on the easy side)</>} numbers={<U t="q">{f(b.b[2], 3)}</U>} result={sg(b.q)} />
        <Calc t="beta" name="popularity boost" words="b3, at least 0" numbers={<U t="beta">{f(b.b[3], 3)}</U>} result={`${f(b.beta)}% per doubling of players`} />
        <Calc t="s" name="scatter" words={<>&radic;(Σ each chart&apos;s miss from the curve, squared &divide; (charts &minus; 4))</>} numbers={<>&radic;({f(b.miss2, 2)} &divide; (<U t="pool">{b.pool}</U> &minus; 4))</>} result={`${f(b.s)}%`} />
      </Block>

      <Block step="step-5" title="this chart's gap">
        <Input label="middle score" value={`${f(b.mid.m, 3)}%`} from="step 2" t="m" />
        <Input label="players" value={b.n} from={`maishift, band ${band}`} />
        <div className="wx-input"><span className="wx-label">popularity boost, average popularity, typical score</span><span className="wx-value"><U t="beta">{f(b.beta, 3)}</U>, <U t="xbar">{f(b.xbar, 3)}</U>, <U t="a">{f(b.a, 3)}%</U></span><span className="wx-from">from: step 4</span></div>
        <Calc t="log2n" name="log₂ players" numbers={<>log&#8322; {b.n}</>} result={f(b.log2n, 3)} />
        <Calc t="adjusted" name="adjusted score" words="middle score − popularity boost × (log₂ players − average popularity)"
          numbers={<><U t="m">{f(b.mid.m, 3)}</U> &minus; <U t="beta">{f(b.beta, 3)}</U> &times; (<U t="log2n">{f(b.log2n, 3)}</U> &minus; <U t="xbar">{f(b.xbar, 3)}</U>)</>} result={`${f(b.adjusted)}%`} />
        <Calc t="gap" name="accuracy gap" words="adjusted score − typical score" numbers={<><U t="adjusted">{f(b.adjusted, 3)}</U> &minus; <U t="a">{f(b.a, 3)}</U></>} result={`${sg(b.gap)}% (${b.gap >= 0 ? 'better: easier' : 'worse: harder'})`} />
      </Block>

      <Block step="step-6" title="turn it into constant">
        <Calc t="dc" name="constant gap" words="accuracy gap ÷ accuracy per +1.0 constant" numbers={<><U t="gap">{neg(b.gap, 3)}</U> &divide; <U t="S">{f(b.S, 3)}</U></>} result={`${sg(b.dc)} (${b.dc >= 0 ? 'easier' : 'harder'})`} />
      </Block>

      <Block step="step-7" title="weight the band">
        <Calc t="sigmaB" name="band uncertainty" words="scatter ÷ accuracy per +1.0 constant" numbers={<><U t="s">{f(b.s, 3)}</U> &divide; <U t="S">{f(b.S, 3)}</U></>} result={f(b.sigmaB, 3)} />
        <Calc t="w" name="band weight" words="1 ÷ band uncertainty²" numbers={<>1 &divide; <U t="sigmaB">{f(b.sigmaB, 3)}</U>&sup2;</>} result={f(b.w)} />
        <p className="wx-note">every band, through steps 2 to 7 (the band worked above is highlighted):</p>
        <div className="wx-counts">
          <table>
            <thead><tr><th>band</th><th>players</th><th>middle score</th><th>adjusted</th><th>typical</th><th>per +1.0 constant</th><th>accuracy gap</th><th>constant gap</th><th>uncertainty</th><th>weight</th></tr></thead>
            <tbody>
              {X.bands.map((x) => isB(x) ? (
                <tr key={x.from_} className="wx-hit-row">
                  <td>{int(x.from_)}</td><td>{x.n}</td><td><U t="m">{f(x.mid.m)}%</U></td><td><U t="adjusted">{f(x.adjusted)}%</U></td><td><U t="a">{f(x.a)}%</U></td><td><U t="S">{f(x.S)}%</U></td>
                  <td><U t="gap">{sg(x.gap)}%</U></td><td><U t="dc">{sg(x.dc)}</U></td><td><U t="sigmaB">{f(x.sigmaB, 3)}</U></td><td><U t="w">{f(x.w)}</U></td>
                </tr>
              ) : (
                <tr key={x.from_}>
                  <td>{int(x.from_)}</td><td>{x.n}</td><td>{f(x.mid.m)}%</td><td>{f(x.adjusted)}%</td><td>{f(x.a)}%</td><td>{f(x.S)}%</td><td>{sg(x.gap)}%</td><td>{sg(x.dc)}</td><td>{f(x.sigmaB, 3)}</td><td>{f(x.w)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block step="step-8" title="combine the bands">
        <Calc t="sumW" name="total weight" words="every band's weight added up" numbers={<Joined sep=" + " items={X.bands.map((x) => ({ text: f(x.w), t: isB(x) ? 'w' as Token : undefined }))} />} result={f(X.sumW)} />
        <Calc t="sumWdc" name="weighted gaps" words="every band's weight × constant gap, added up"
          numbers={<>{X.bands.map((x, i) => <span key={x.from_}>{i > 0 && ' + '}{isB(x) ? <><U t="w">{f(x.w)}</U> &times; <U t="dc">{neg(x.dc)}</U></> : `${f(x.w)} × ${neg(x.dc)}`}</span>)}</>} result={sg(X.sumWdc)} />
        <Calc t="DC" name="constant gap" words="weighted gaps ÷ total weight" numbers={<><U t="sumWdc">{neg(X.sumWdc)}</U> &divide; <U t="sumW">{f(X.sumW)}</U></>} result={`${sg(X.dc, 3)} (${X.dc >= 0 ? 'easier' : 'harder'})`} />
        <Calc t="sigma" name="uncertainty" words="1 ÷ √total weight" numbers={<>1 &divide; &radic;<U t="sumW">{f(X.sumW)}</U></>} result={f(X.sigma, 3)} />
        <Calc t="move" name="move" words={<>constant gap, held between &minus;{CAP} and +{CAP}</>} numbers={<U t="DC">{sg(X.dc, 3)}</U>} result={sg(X.move, 3)} />
        <Calc t="candidate" name="plays like" words="constant − move, rounded to 0.1" numbers={<>{X.constant} &minus; <U t="move">{neg(X.move, 3)}</U> = {f(X.constant - X.move, 3)}</>} result={X.candidate.toFixed(1)} />
      </Block>

      <Block step="step-9" title="how sure?">
        <Calc t="candidate" name="check" words={<>sure if uncertainty &le; {SIGMA_MAX}; shown marked uncertain up to {SIGMA_SHOW_MAX}; hidden above</>}
          numbers={<><U t="sigma">{f(X.sigma, 3)}</U> {X.sure ? '≤' : '>'} {SIGMA_MAX}{!X.sure && <>, {X.shown ? '≤' : '>'} {SIGMA_SHOW_MAX}</>}</>}
          result={X.sure ? `sure: plays like ${X.candidate.toFixed(1)}` : X.shown ? `uncertain: plays like ${X.candidate.toFixed(1)}, marked uncertain` : 'not shown'} />
        <p className="wx-note">
          {X.sure
            ? <>the song page shows plays like {X.candidate.toFixed(1)}. {leanSame} of {X.bands.length} bands lean the same way.</>
            : <>{leanSame} of {X.bands.length} bands lean the same way ({X.dc >= 0 ? 'easier' : 'harder'}), but the typical charts here are spread out enough that a {sg(X.dc)} gap isn&apos;t certain, so the song page shows {X.candidate.toFixed(1)} with an uncertain label.</>}
        </p>
      </Block>
    </div>
  );
}
