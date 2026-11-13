import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import PlaysLikeFitGraph from '../../components/PlaysLikeFitGraph';
import PlaysLikeTabs from '../../components/PlaysLikeTabs';
import PlaysLikeWorkedExample from '../../components/PlaysLikeWorkedExample';
import { CAP, MAX_CONSTANT, SIGMA_MAX, SIGMA_SHOW_MAX, S_MIN } from '../../lib/plays-like';
import { MIN_CHARTS, REACH_TENTHS, SCATTER_MIN } from '../../lib/maishift-feel';
import { WORKED_EXAMPLES } from '../../lib/plays-like-worked';

/**
 * "how plays like works": a switch between the method (every step as an equation, each with a
 * dropdown that says it in words, and what each value is) and two worked examples that run a
 * chart through every calculation (components/PlaysLikeWorkedExample.tsx): a sure result and an
 * uncertain one. The song page's popup (components/SongPageView.tsx, SimpleHow) links to the
 * steps by id (#step-1 ... #step-9); PlaysLikeTabs opens the right tab for any link. Settings
 * come from the code, so they can't drift. This site's own-players fallback is explained in the
 * popup when a chart uses it, not here. The doc "How plays like is worked out" matches.
 */

export const metadata: Metadata = {
  title: 'how plays like works - HI Maimai',
  description: 'every step behind a chart\'s "plays like" rating, with formulas and worked examples.',
};

const W = REACH_TENTHS / 10;

/** An equation, with a dropdown that says the same thing in words. */
function Eq({ children, words }: { children: ReactNode; words: ReactNode }) {
  return (
    <details className="pl-eq">
      <summary><span className="pl-eq-math">{children}</span><span className="pl-eq-hint">in words</span></summary>
      <div className="pl-eq-words">{words}</div>
    </details>
  );
}
function Where({ children }: { children: ReactNode }) {
  return <ul className="pl-where">{children}</ul>;
}
function Step({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="pl-step">
      <h3><a href={`#${id}`} className="pl-anchor" aria-label={`link to ${title}`}>#</a>{title}</h3>
      {children}
    </section>
  );
}
const V = ({ n, s }: { n: string; s?: string }) => <i>{n}{s && <sub>{s}</sub>}</i>;
const Why = ({ children }: { children: ReactNode }) => <p className="pl-why">{children}</p>;

function Method() {
  return (
    <>
      <nav className="pl-toc" aria-label="steps">
        <b>steps:</b> <a href="#step-1">1 bands</a> · <a href="#step-2">2 middle score</a> · <a href="#step-3">3 pool</a> · <a href="#step-4">4 typical curve</a> · <a href="#step-5">5 gap</a> · <a href="#step-6">6 in constant</a> · <a href="#step-7">7 weights</a> · <a href="#step-8">8 combine</a> · <a href="#step-9">9 how sure</a>
      </nav>

      <h2 id="in-short">in short</h2>
      <ol className="pl-short">
        <li><b>who:</b> maishift players rated around what an SSS+ on the chart is worth, split into rating bands. <a href="#step-1">step 1</a></li>
        <li><b>how they do:</b> in each band, the score of the middle player. <a href="#step-2">step 2</a></li>
        <li><b>what&apos;s typical:</b> a best-fit curve through every recent chart within {W} of this constant: what a typical chart at this constant scores, and how much scores drop per +1.0 constant. <a href="#step-3">step 3</a>, <a href="#step-4">step 4</a></li>
        <li><b>the gap, in constant:</b> how far above or below the curve this chart sits, divided by how much +1.0 constant is worth. <a href="#step-5">step 5</a>, <a href="#step-6">step 6</a></li>
        <li><b>every band together:</b> averaged, steadier bands counting more, moved at most {CAP}; marked uncertain or hidden when it isn&apos;t sure. <a href="#step-7">steps 7–9</a></li>
      </ol>
      <p className="pl-data">
        data: <a href="https://maimai.shiftpsh.com" target="_blank" rel="noopener noreferrer">maishift</a>&apos;s rank counts (one result per player per chart) for NA players rated 13,000 or more who synced in the last 90 days.
        charts maishift has no numbers for use this site&apos;s own players instead, explained in the popup when they do. unofficial, not affiliated with SEGA.
      </p>

      <details className="pl-vars" id="variables">
        <summary>variables</summary>
        <p>a small <i>b</i> marks a value worked out separately in each rating band; <i>j</i> marks one comparison chart.</p>
        <table className="pl-table">
          <thead><tr><th>name</th><th>what it is</th></tr></thead>
          <tbody>
            <tr><td><V n="c" /></td><td>the chart&apos;s constant</td></tr>
            <tr><td><V n="R" /></td><td>center rating: what an SSS+ on the chart is worth &times; 50</td></tr>
            <tr><td><V n="b" />, <V n="B" /></td><td>one rating band, and every band used</td></tr>
            <tr><td><V n="n" s="b" /></td><td>this chart&apos;s players in band <i>b</i></td></tr>
            <tr><td><V n="m" s="b" /></td><td>middle score: the middle player&apos;s accuracy (%)</td></tr>
            <tr><td><V n="P" s="b" />, <V n="j" /></td><td>the comparison pool, and one chart in it</td></tr>
            <tr><td><V n="d" s="j" /></td><td>constant difference: chart <i>j</i>&apos;s constant minus <i>c</i></td></tr>
            <tr><td><V n="x" s="j" />, <i>x&#772;</i></td><td>popularity: chart <i>j</i>&apos;s log&#8322; players minus the pool&apos;s average, and that average</td></tr>
            <tr><td><V n="a" s="b" /></td><td>typical score: the fitted curve&apos;s height at <i>c</i> (%)</td></tr>
            <tr><td><V n="S" s="b" /></td><td>accuracy per +1.0 constant: % a typical chart loses per +1.0 constant, at <i>c</i></td></tr>
            <tr><td><V n="q" s="b" /></td><td>bend: how much the typical curve curves</td></tr>
            <tr><td><V n="β" s="b" /></td><td>popularity boost: % gained per doubling of players</td></tr>
            <tr><td><V n="s" s="b" /></td><td>scatter: how far charts sit from the curve (%)</td></tr>
            <tr><td><i>m&#771;<sub>b</sub></i></td><td>adjusted score: this chart&apos;s middle score with popularity evened out (%)</td></tr>
            <tr><td><V n="g" s="b" /></td><td>accuracy gap: adjusted score minus typical score (%)</td></tr>
            <tr><td><V n="Δc" s="b" />, <V n="Δc" /></td><td>constant gap, per band and combined</td></tr>
            <tr><td><V n="σ" s="b" />, <V n="w" s="b" />, <V n="σ" /></td><td>band uncertainty, band weight, and the result&apos;s uncertainty (constant)</td></tr>
          </tbody>
        </table>
        <table className="pl-table">
          <thead><tr><th>setting</th><th>value</th><th>what it does</th></tr></thead>
          <tbody>
            <tr><td><V n="W" /></td><td>{W}</td><td>how far either side of <i>c</i> the comparison charts reach</td></tr>
            <tr><td>fewest charts</td><td>{MIN_CHARTS}</td><td>comparison charts a band needs</td></tr>
            <tr><td><V n="S" s="min" /></td><td>{S_MIN}% per +1.0 constant</td><td>the lowest accuracy per +1.0 constant allowed</td></tr>
            <tr><td><V n="s" s="min" /></td><td>{SCATTER_MIN}%</td><td>the lowest scatter allowed</td></tr>
            <tr><td><V n="σ" s="max" /></td><td>{SIGMA_MAX}</td><td>a result this sure or better is shown as is</td></tr>
            <tr><td><V n="σ" s="show" /></td><td>{SIGMA_SHOW_MAX}</td><td>up to this, shown marked uncertain; above, hidden</td></tr>
            <tr><td>CAP</td><td>{CAP}</td><td>the most plays like can move from <i>c</i></td></tr>
            <tr><td>MAX</td><td>{MAX_CONSTANT.toFixed(1)}</td><td>the highest constant</td></tr>
          </tbody>
        </table>
      </details>

      <h2 id="maishift">the steps</h2>
      <p className="pl-hint">click an equation to read it in words. the examples tabs above run real charts through every step.</p>

      <Step id="step-1" title="step 1: pick the bands">
        <Eq words={<>center rating = the game&apos;s rating for an SSS+ (100.5%) on a chart of this constant, &times; 50, at most 16,600</>}>
          <V n="R" /> = floor(min(<V n="c" />, MAX) &times; 22.4 &times; 100.5 &divide; 100) &times; 50
        </Eq>
        <Eq words={<>rating bands = maishift&apos;s bands from the 250-wide group the center rating is in, plus 3 groups either side</>}>
          <V n="B" /> = maishift bands from <V n="R" /> &minus; 750 to <V n="R" /> + 750
        </Eq>
        <Where>
          <li><V n="c" />: the chart&apos;s constant (song list)</li>
          <li>maishift&apos;s bands: 13,000–13,500, 13,500–14,000, then every 250 up to 17,000</li>
        </Where>
        <Why>players far above a chart score near 101% on everything, and players far below rarely clear it well; neither can tell charts apart.</Why>
      </Step>

      <Step id="step-2" title="step 2: middle score from rank counts">
        <Eq words={<>
          middle score = the low end of the middle player&apos;s rank + (half the players &minus; players below that rank) &divide; players in that rank &times; the rank&apos;s width.
          <br />with exact scores you&apos;d sort them and take the middle one; maishift only gives rank counts, so this finds the rank the middle player is in and places them inside it as if that rank&apos;s players were spread evenly.
        </>}>
          <V n="m" /> = <V n="L" /> + (<V n="N" />/2 &minus; below) &divide; <V n="n" s="k" /> &times; (<V n="H" /> &minus; <V n="L" />)
        </Eq>
        <Where>
          <li><V n="N" />: players in the band (maishift; players its rank counts miss count as SSS+)</li>
          <li><V n="k" />: the rank where the running total of rank counts, from &lt;94 up, reaches <i>N</i>/2; below: the running total before it; <V n="n" s="k" />: players in it</li>
          <li><V n="L" />, <V n="H" />: rank <i>k</i>&apos;s range: &lt;94 90–94, AAA 94–97, S 97–98, S+ 98–99, SS 99–99.5, SS+ 99.5–100, SSS 100–100.5, SSS+ 100.5–101, AP+ 101</li>
        </Where>
        <Why>the median is the best &ldquo;typical player&rdquo; figure from rank counts: one AP+ or one fail barely moves it.</Why>
      </Step>

      <Step id="step-3" title="step 3: build the comparison pool">
        <Eq words={<>comparison pool = every chart from the same era, within {W} of this constant, with players in this band, except this chart</>}>
          <V n="P" s="b" /> = {'{'} <i>j</i> : era<sub>j</sub> = era, |<V n="c" s="j" /> &minus; <V n="c" />| &le; <V n="W" />, <i>j</i> &ne; this chart {'}'}
        </Eq>
        <Where>
          <li>era: FESTiVAL and later, DX to UNiVERSE PLUS, or maimai to FiNALE</li>
          <li>at least {MIN_CHARTS} charts; with fewer, the versions just outside the era are added one each side at a time, and a band that still has too few is skipped</li>
        </Where>
        <Why>new charts score higher than old ones at the same constant. the pool spans {W} either side so step 4 can see how scores change with constant.</Why>
      </Step>

      <Step id="step-4" title="step 4: fit the typical curve">
        <Eq words={<>a chart&apos;s middle score &asymp; typical score &minus; accuracy per +1.0 constant &times; constant difference + bend &times; constant difference&sup2; + popularity boost &times; popularity</>}>
          <V n="m" s="j" /> &asymp; <V n="a" s="b" /> &minus; <V n="S" s="b" />&middot;<V n="d" s="j" /> + <V n="q" s="b" />&middot;<V n="d" s="j" />&sup2; + <V n="β" s="b" />&middot;<V n="x" s="j" />
        </Eq>
        <Where>
          <li><V n="m" s="j" />, <V n="d" s="j" />, <V n="x" s="j" />: measured for every chart in the pool (step 2 on its rank counts, its constant &minus; <i>c</i>, its log&#8322; players &minus; the pool&apos;s average)</li>
          <li><V n="a" s="b" />, <V n="S" s="b" />, <V n="q" s="b" />, <V n="β" s="b" />: the fit&apos;s outputs, the four values that make the curve miss the pool&apos;s middle scores least (smallest total of squared misses); <i>S</i> at least {S_MIN}, <i>β</i> at least 0</li>
        </Where>
        <PlaysLikeFitGraph example={WORKED_EXAMPLES.kisukitsune} />
        <details className="pl-more">
          <summary>how to find the fit yourself</summary>
          <p>with <i>b</i>0 = <i>a</i>, <i>b</i>1 = &minus;<i>S</i>, <i>b</i>2 = <i>q</i>, <i>b</i>3 = <i>β</i>, solve these four equations together (every &Sigma; adds up over the pool&apos;s <i>N</i> charts):</p>
          <table className="pl-matrix">
            <tbody>
              <tr><td>N</td><td>&Sigma;d</td><td>&Sigma;d&sup2;</td><td>&Sigma;x</td><td className="pl-matrix-b">b0</td><td className="pl-matrix-eq">&Sigma;m</td></tr>
              <tr><td>&Sigma;d</td><td>&Sigma;d&sup2;</td><td>&Sigma;d&sup3;</td><td>&Sigma;xd</td><td className="pl-matrix-b">b1</td><td className="pl-matrix-eq">&Sigma;d&middot;m</td></tr>
              <tr><td>&Sigma;d&sup2;</td><td>&Sigma;d&sup3;</td><td>&Sigma;d&#8308;</td><td>&Sigma;xd&sup2;</td><td className="pl-matrix-b">b2</td><td className="pl-matrix-eq">&Sigma;d&sup2;&middot;m</td></tr>
              <tr><td>&Sigma;x</td><td>&Sigma;xd</td><td>&Sigma;xd&sup2;</td><td>&Sigma;x&sup2;</td><td className="pl-matrix-b">b3</td><td className="pl-matrix-eq">&Sigma;x&middot;m</td></tr>
            </tbody>
          </table>
          <p className="pl-why">each row: (first &times; b0) + (second &times; b1) + (third &times; b2) + (fourth &times; b3) = the number on the right. in a spreadsheet, =LINEST(m column, the d, d&sup2;, x columns) gives <i>β</i>, <i>q</i>, &minus;<i>S</i>, <i>a</i> (in that order).</p>
        </details>
        <Eq words={<>scatter = &radic;(each chart&apos;s miss from the curve, squared, added up &divide; (charts &minus; 4)), at least {SCATTER_MIN}%</>}>
          <V n="s" s="b" /> = &radic;( &Sigma; (<V n="m" s="j" /> &minus; <i>m&#770;<sub>j</sub></i>)&sup2; &divide; (|<V n="P" s="b" />| &minus; 4) )
        </Eq>
        <Why>accuracy per +1.0 constant is what turns accuracy into constant, measured instead of guessed. a curve, not a line, because scores flatten near 101%.</Why>
      </Step>

      <Step id="step-5" title="step 5: this chart's gap">
        <Eq words={<>adjusted score = middle score &minus; popularity boost &times; (log&#8322; players &minus; average log&#8322; players)</>}>
          <i>m&#771;<sub>b</sub></i> = <V n="m" s="b" /> &minus; <V n="β" s="b" />&middot;(log&#8322; <V n="n" s="b" /> &minus; <i>x&#772;</i>)
        </Eq>
        <Eq words={<>accuracy gap = adjusted score &minus; typical score (+ means players do better here: easier)</>}>
          <V n="g" s="b" /> = <i>m&#771;<sub>b</sub></i> &minus; <V n="a" s="b" />
        </Eq>
        <Why>this chart with its popularity made average, against a typical chart at the same constant.</Why>
      </Step>

      <Step id="step-6" title="step 6: turn it into constant">
        <Eq words={<>constant gap = accuracy gap &divide; accuracy per +1.0 constant (% &divide; % per +1.0 constant = constant)</>}>
          <V n="Δc" s="b" /> = <V n="g" s="b" /> &divide; <V n="S" s="b" />
        </Eq>
        <Why>each band uses its own rate: near the top, +1.0 constant is worth much less accuracy than lower down.</Why>
      </Step>

      <Step id="step-7" title="step 7: weight the bands">
        <Eq words={<>band uncertainty = scatter &divide; accuracy per +1.0 constant</>}>
          <V n="σ" s="b" /> = <V n="s" s="b" /> &divide; <V n="S" s="b" />
        </Eq>
        <Eq words={<>band weight = 1 &divide; band uncertainty&sup2;</>}>
          <V n="w" s="b" /> = 1 &divide; <V n="σ" s="b" />&sup2;
        </Eq>
        <Why>bands where charts sit close to the curve, compared with how fast scores change, count more.</Why>
      </Step>

      <Step id="step-8" title="step 8: combine, cap, round">
        <Eq words={<>constant gap = (each band&apos;s weight &times; its constant gap, added up) &divide; (every weight added up)</>}>
          <V n="Δc" /> = &Sigma; <V n="w" s="b" />&middot;<V n="Δc" s="b" /> &divide; &Sigma; <V n="w" s="b" />
        </Eq>
        <Eq words={<>uncertainty = 1 &divide; &radic;(every weight added up)</>}>
          <V n="σ" /> = 1 &divide; &radic;&Sigma; <V n="w" s="b" />
        </Eq>
        <Eq words={<>plays like = constant &minus; constant gap (held within &plusmn;{CAP}), rounded to 0.1, at most {MAX_CONSTANT.toFixed(1)}</>}>
          plays like = min(MAX, round(<V n="c" /> &minus; clamp(<V n="Δc" />, &plusmn;CAP), 0.1))
        </Eq>
      </Step>

      <Step id="step-9" title="step 9: how sure?">
        <Eq words={<>sure if the uncertainty is {SIGMA_MAX} or less; from there up to {SIGMA_SHOW_MAX}, shown with an &ldquo;uncertain&rdquo; label; above {SIGMA_SHOW_MAX}, hidden as too close to call</>}>
          <V n="σ" /> &le; {SIGMA_MAX}: sure &nbsp;·&nbsp; {SIGMA_MAX} &lt; <V n="σ" /> &le; {SIGMA_SHOW_MAX}: uncertain &nbsp;·&nbsp; <V n="σ" /> &gt; {SIGMA_SHOW_MAX}: hidden
        </Eq>
        <Why>a big uncertainty means the typical charts vary so much the gap could be noise. above {SIGMA_SHOW_MAX} (mostly level 11s, where maishift&apos;s lowest band is already too strong) the number isn&apos;t worth showing.</Why>
      </Step>

      <h2 id="old-method">compared with the old method, and limits</h2>
      <ul className="pl-limits">
        <li><b>old method:</b> moved the constant by (gap &divide; scatter) &times; 0.2, a picked number. now it&apos;s gap &divide; accuracy per +1.0 constant: the same idea with that 0.2 measured in each band.</li>
        <li><b>curve shape:</b> a parabola over &plusmn;{W}; near 101% it&apos;s only an approximation.</li>
        <li><b>middle score, not SSS+:</b> a chart can be easy to score well on but hard to max out; plays like follows the middle player.</li>
        <li><b>rank ranges:</b> the middle score assumes players are spread evenly inside a rank.</li>
      </ul>
    </>
  );
}

export default function PlaysLikePage() {
  const { kisukitsune, uncertain } = WORKED_EXAMPLES;
  return (
    <main className="pl-page">
      <style>{css}</style>
      <p className="pl-back"><Link href="/charts">&larr; charts</Link></p>
      <h1>how &ldquo;plays like&rdquo; works</h1>
      <p className="pl-lead">
        &ldquo;plays like&rdquo; is the constant a chart feels like to the players it&apos;s aimed at: how much better or worse they score on it than on typical charts
        of the same constant, turned into constant with a measured rate.
      </p>
      <div className="pl-headline">plays like = constant &minus; (accuracy gap &divide; accuracy per +1.0 constant)</div>
      <PlaysLikeTabs tabs={[
        { id: 'method', label: 'the method', content: <Method /> },
        { id: 'example-kisukitsune', label: `example: ${kisukitsune.title}`, content: <PlaysLikeWorkedExample example={kisukitsune} /> },
        { id: 'example-uncertain', label: `uncertain example: ${uncertain.title}`, content: <PlaysLikeWorkedExample example={uncertain} /> },
      ]} />
    </main>
  );
}

const css = `
  .pl-page { padding: 0 2rem 3rem; max-width: 860px; margin: 0 auto; font-family: sans-serif; line-height: 1.6; color: var(--text-main); }
  .pl-page h1 { border-bottom: 1px solid var(--border-strong); padding-bottom: 0.5rem; margin-top: 0.5rem; }
  .pl-page h2 { margin: 2rem 0 0.6rem; padding-top: 0.5rem; border-top: 1px solid var(--border-light); font-size: 1.3rem; scroll-margin-top: 1rem; }
  .pl-page h3 { margin: 1.5rem 0 0.4rem; font-size: 1.08rem; }
  .pl-page p, .pl-page li { color: var(--faq-sub); }
  .pl-page b { color: var(--text-main); }
  .pl-page i { font-family: 'Times New Roman', Georgia, serif; font-size: 1.08em; color: var(--text-main); }
  .pl-back { margin: 1rem 0 0; font-size: 0.85rem; }
  .pl-headline { margin: 0.75rem 0 1.25rem; padding: 0.7rem 1rem; border: 1px solid var(--btn-border); border-radius: 8px; background: var(--btn-bg); color: var(--text-main); font-weight: 700; }
  .pl-tabs-wrap { scroll-margin-top: 1rem; }
  .pl-tabs { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0; margin-bottom: 0.5rem; background: var(--bg-color); border-bottom: 1px solid var(--border-light); }
  .pl-tabs button { all: unset; cursor: pointer; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--btn-border); background: var(--btn-bg); color: var(--btn-text); font-size: 0.88rem; font-weight: 600; }
  .pl-tabs button.is-on { background: #dd2c76; border-color: #dd2c76; color: #fff; }
  .pl-tabs button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .pl-toc { margin: 0.75rem 0 0.5rem; font-size: 0.88rem; color: var(--faq-sub); }
  .pl-short li { margin: 0.25rem 0; }
  .pl-data { font-size: 0.88rem; }
  .pl-hint { font-size: 0.88rem; color: var(--text-muted) !important; }
  .pl-vars, .pl-more { margin: 1rem 0; border: 1px solid var(--btn-border); border-radius: 8px; }
  .pl-vars > summary, .pl-more > summary { cursor: pointer; padding: 0.55rem 0.9rem; font-weight: 700; color: var(--text-main); }
  .pl-vars > *:not(summary), .pl-more > *:not(summary) { margin-left: 0.9rem; margin-right: 0.9rem; }
  .pl-step { scroll-margin-top: 4rem; }
  .pl-step:target h3 { color: var(--faq-highlight-text); }
  .pl-anchor { margin-right: 0.4rem; color: var(--text-muted); text-decoration: none; }
  .pl-anchor:hover { color: var(--faq-highlight-text); }
  .pl-eq { margin: 0.5rem 0; border: 1px solid var(--btn-border); border-radius: 8px; background: var(--btn-bg); }
  .pl-eq > summary { cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.6rem 0.9rem; color: var(--text-main); }
  .pl-eq > summary::-webkit-details-marker { display: none; }
  .pl-eq-math { overflow-x: auto; white-space: nowrap; }
  .pl-eq-hint { flex: none; font-size: 0.72rem; color: var(--text-muted); border: 1px solid var(--btn-border); border-radius: 999px; padding: 1px 8px; }
  .pl-eq-hint::after { content: ' ▾'; }
  .pl-eq[open] .pl-eq-hint::after { content: ' ▴'; }
  .pl-eq-words { padding: 0.55rem 0.9rem 0.7rem; border-top: 1px dashed var(--btn-border); color: var(--faq-sub); font-size: 0.92rem; }
  .pl-where { margin: 0.4rem 0 0.4rem; padding-left: 1.25rem; font-size: 0.9rem; }
  .pl-where li { margin: 0.1rem 0; }
  .pl-why { font-size: 0.88rem; color: var(--text-muted) !important; margin: 0.3rem 0 0; }
  .pl-limits li { margin: 0.25rem 0; font-size: 0.92rem; }
  .pl-table { border-collapse: collapse; width: 100%; margin: 0.6rem 0 1rem; font-size: 0.9rem; }
  .pl-table th, .pl-table td { text-align: left; padding: 0.3rem 0.6rem; border-bottom: 1px solid var(--border-light); vertical-align: top; color: var(--faq-sub); }
  .pl-table th { color: var(--text-main); }
  .pl-matrix { border-collapse: collapse; margin: 0.5rem 0 0.25rem; font-family: 'Times New Roman', Georgia, serif; font-size: 1rem; color: var(--text-main); }
  .pl-matrix td { padding: 0.25rem 0.7rem; text-align: center; border-left: 1px solid var(--border-light); }
  .pl-matrix td:first-child, .pl-matrix-b, .pl-matrix-eq { border-left: 2px solid var(--text-muted) !important; }
  .pl-matrix-b { font-weight: 700; }
  .pl-graph { margin: 0.75rem 0; }
  .pl-graph svg { width: 100%; height: auto; display: block; }
  .pl-graph figcaption { font-size: 0.78rem; color: var(--text-muted); }
  .pl-graph-title { font-size: 16px; fill: var(--text-main); }
  .pl-graph-sub { font-size: 12px; fill: var(--text-muted); }
  .pl-graph-label { font-size: 12px; fill: var(--text-main); }
  .pl-graph-accent { font-size: 12px; fill: #dd2c76; }
  .pl-graph-grid { stroke: var(--border-light); }
  .pl-graph-dot { fill: var(--text-muted); fill-opacity: 0.5; }
  .pl-graph-curve { fill: none; stroke: var(--text-sub); stroke-width: 2.5; }
  .pl-graph-leader { stroke: var(--text-muted); stroke-width: 0.8; }
  .pl-graph-gap { stroke: #dd2c76; stroke-width: 2; }
  .pl-graph-typical { fill: var(--text-sub); }
  .pl-graph-target { fill: #dd2c76; }
  .wx-title { margin: 1rem 0 0.4rem !important; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
  .wx-uncertain { display: inline-block; padding: 1px 9px; border-radius: 999px; border: 1px solid #f5a524; background: rgba(245, 165, 36, 0.16); color: #f5a524; font-size: 0.75rem; font-weight: 700; }
  .wx-uncertain-note { padding: 0.55rem 0.9rem; border-left: 3px solid #f5a524; background: rgba(245, 165, 36, 0.1); border-radius: 0 8px 8px 0; font-size: 0.9rem; }
  .wx-intro { font-size: 0.88rem; }
  .wx-step { margin: 0 0 1rem; padding: 0.7rem 0.9rem; border: 1px solid var(--border-light); border-radius: 8px; }
  .wx-step h4 { margin: 0 0 0.5rem; font-size: 0.95rem; }
  .wx-step h4 a { color: var(--faq-highlight-text); text-decoration: none; }
  .wx-input { display: grid; grid-template-columns: minmax(8rem, max-content) max-content 1fr; gap: 0.75rem; align-items: baseline; font-size: 0.88rem; padding: 0.15rem 0; }
  .wx-label { color: var(--text-muted); }
  .wx-value { font-weight: 700; color: var(--text-main); font-variant-numeric: tabular-nums; }
  .wx-from { font-size: 0.78rem; color: var(--text-muted); }
  .wx-calc { margin: 0.45rem 0; padding: 0.4rem 0.6rem; border-left: 3px solid var(--border-strong); font-size: 0.9rem; }
  .wx-name { font-weight: 700; color: var(--text-main); }
  .wx-words { color: var(--text-muted); font-size: 0.85rem; }
  .wx-numbers { color: var(--faq-sub); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .wx-t0 { --wx: 221, 44, 118; }
  .wx-t1 { --wx: 59, 130, 246; }
  .wx-t2 { --wx: 217, 119, 6; }
  .wx-t3 { --wx: 13, 148, 136; }
  .wx-t4 { --wx: 139, 92, 246; }
  .wx-t5 { --wx: 22, 163, 74; }
  .wx-result { display: inline-block; padding: 0 0.4rem; border-radius: 5px; background: rgba(var(--wx, 221, 44, 118), 0.16); color: rgb(var(--wx, 221, 44, 118)); font-weight: 700; }
  .wx-use { color: rgb(var(--wx)); font-weight: 700; text-decoration: underline; text-decoration-color: rgba(var(--wx), 0.7); text-decoration-thickness: 2px; text-underline-offset: 3px; }
  .wx-note { font-size: 0.86rem; margin: 0.5rem 0 0.3rem; }
  .wx-counts { overflow-x: auto; margin: 0.4rem 0 0.6rem; }
  .wx-counts table { border-collapse: collapse; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
  .wx-counts th, .wx-counts td { padding: 0.25rem 0.5rem; border-bottom: 1px solid var(--border-light); text-align: right; white-space: nowrap; color: var(--faq-sub); }
  .wx-counts th { color: var(--text-main); font-weight: 600; text-align: left; }
  .wx-hit { outline: 1px solid var(--border-strong); font-weight: 700; color: var(--text-main) !important; }
  .wx-hit-row td { background: var(--btn-bg); }
  @media (max-width: 600px) {
    .pl-page { padding: 0 1rem 2rem; }
    .pl-eq > summary { flex-direction: column; align-items: flex-start; gap: 0.3rem; }
    .pl-eq-math { white-space: normal; }
    .wx-input { grid-template-columns: 1fr; gap: 0; }
  }
`;
