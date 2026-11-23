import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import PlaysLikeFitGraph from '../../components/PlaysLikeFitGraph';
import PlaysLikeTabs from '../../components/PlaysLikeTabs';
import PlaysLikeWorkedExample from '../../components/PlaysLikeWorkedExample';
import Tex from '../../components/Tex';
import { CAP, MAX_CONSTANT } from '../../lib/plays-like';
import { BUCKETS_ABOVE, BUCKETS_BELOW, MIN_CHARTS, MIN_RATE, REACH_TENTHS, SCATTER_MIN, SINGLE_BUCKET_DISAGREE, SPREAD_MIN_CHARTS, SPREAD_TARGET, SURE_RANGE } from '../../lib/maishift-feel';
import { WORKED_EXAMPLES } from '../../lib/plays-like-worked';

/**
 * "how plays like works": a switch between the rating bucket method (every step as an equation, each
 * with a dropdown that says it in words, and what each value is) and two worked examples that run a
 * chart through every calculation (components/PlaysLikeWorkedExample.tsx): a sure result and an
 * uncertain one. The song page's popup (components/SongPageView.tsx, SimpleHow) links to the
 * steps by id (#step-1 ... #step-10); PlaysLikeTabs opens the right tab for any link. Settings
 * come from the code, so they can't drift. This site's own-players fallback is explained in the
 * popup when a chart uses it, not here. The doc "How plays like is worked out" matches.
 */

export const metadata: Metadata = {
  title: 'how plays like works - HI Maimai',
  description: 'every step behind a chart\'s "plays like" rating, with formulas and worked examples.',
};

const W = REACH_TENTHS / 10;

function Where({ children }: { children: ReactNode }) {
  return <ul className="pl-where">{children}</ul>;
}
const t = String.raw;
/** An equation in symbols, with a dropdown that says it in words and what each symbol is. */
function Eq({ tex, words, vars }: { tex: string; words: ReactNode; vars?: Array<[string, ReactNode]> }) {
  return (
    <details className="pl-eq">
      <summary><span className="pl-eq-math"><Tex block>{tex}</Tex></span><span className="pl-eq-hint">in words</span></summary>
      <div className="pl-eq-words">
        <p>{words}</p>
        {vars && <ul className="pl-where">{vars.map(([s, m], i) => <li key={i}><Tex>{s}</Tex>: {m}</li>)}</ul>}
      </div>
    </details>
  );
}
const M = ({ children }: { children: string }) => <Tex>{children}</Tex>;
function Step({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="pl-step">
      <h3><a href={`#${id}`} className="pl-anchor" aria-label={`link to ${title}`}>#</a>{title}</h3>
      {children}
    </section>
  );
}
const Why = ({ children }: { children: ReactNode }) => <p className="pl-why">{children}</p>;
const GROUPS = 'FESTiVAL to CiRCLE PLUS (and anything newer) · でらっくす (DX) to UNiVERSE PLUS · maimai to FiNALE';

function Method() {
  const pop = WORKED_EXAMPLES.kisukitsune.popularity as Record<string, number>;
  return (
    <>
      <nav className="pl-toc" aria-label="steps">
        <b>steps:</b> <a href="#step-1">1 buckets</a> · <a href="#step-2">2 middle score</a> · <a href="#step-3">3 pool</a> · <a href="#step-4">4 popularity</a> · <a href="#step-5">5 typical line</a> · <a href="#step-6">6 gap</a> · <a href="#step-7">7 in constant</a> · <a href="#step-8">8 combine</a> · <a href="#step-9">9 fit to the level</a> · <a href="#step-10">10 how sure</a>
      </nav>

      <h2 id="in-short">in short</h2>
      <ol className="pl-short">
        <li><b>who:</b> maishift players in rating buckets around what an SSS+ on the chart is worth. <a href="#step-1">step 1</a></li>
        <li><b>how they do:</b> in each bucket, the score of the middle player, with popularity evened out. <a href="#step-2">step 2</a>, <a href="#step-4">step 4</a></li>
        <li><b>what&apos;s typical:</b> a best-fit line through every chart from the same group of versions within {W} of this constant: what a typical chart at this constant scores, and how much scores drop per +1.0 constant. <a href="#step-3">step 3</a>, <a href="#step-5">step 5</a></li>
        <li><b>the gap, in constant:</b> how far above or below the line this chart sits, divided by how much +1.0 constant is worth. <a href="#step-6">step 6</a>, <a href="#step-7">step 7</a></li>
        <li><b>every bucket together:</b> each bucket counts as much as its evidence allows, then the result is fitted to how far charts at this level can sensibly differ. <a href="#step-8">step 8</a>, <a href="#step-9">step 9</a></li>
        <li><b>how sure:</b> a 95% range; sure, marked uncertain, or hidden. <a href="#step-10">step 10</a></li>
      </ol>
      <p className="pl-data">
        data: <a href="https://maimai.shiftpsh.com" target="_blank" rel="noopener noreferrer">maishift</a>&apos;s rank counts (one result per player per chart) for NA players rated 13,000 or more who synced in the last 90 days.
        charts maishift has no numbers for use this site&apos;s own players instead, explained in the popup when they do. unofficial, not affiliated with SEGA.
      </p>

      <details className="pl-vars" id="variables">
        <summary>variables</summary>
        <p>a small <M>b</M> marks a value worked out separately in each rating bucket; <M>j</M> marks one comparison chart.</p>
        <table className="pl-table">
          <thead><tr><th>symbol</th><th>what it is</th></tr></thead>
          <tbody>
            <tr><td><M>c</M></td><td>the chart&apos;s constant</td></tr>
            <tr><td><M>R</M></td><td>center rating: what an SSS+ on the chart is worth &times; 50</td></tr>
            <tr><td><M>{t`g(x)`}</M></td><td>the 250-wide rating group a rating <M>x</M> is in</td></tr>
            <tr><td><M>{t`b,\ B`}</M></td><td>one rating bucket, and every bucket used</td></tr>
            <tr><td><M>k</M></td><td>a bucket&apos;s place: <M>{t`g(b) - g(R)`}</M></td></tr>
            <tr><td><M>{t`N_b`}</M></td><td>this chart&apos;s players in bucket <M>b</M></td></tr>
            <tr><td><M>{t`m_b,\ e_b`}</M></td><td>middle score (the middle player&apos;s accuracy, %) and its error</td></tr>
            <tr><td><M>{t`V`}</M></td><td>a group of versions: {GROUPS}</td></tr>
            <tr><td><M>{t`P_b,\ j`}</M></td><td>the comparison pool, and one chart in it</td></tr>
            <tr><td><M>{t`d_j`}</M></td><td>constant difference: chart <M>j</M>&apos;s constant minus <M>c</M></td></tr>
            <tr><td><M>{t`x_j,\ \bar x`}</M></td><td>log&#8322; of chart <M>j</M>&apos;s players, and its average over the pool</td></tr>
            <tr><td><M>{t`p_k`}</M></td><td>popularity rate: % per doubling of players, for buckets at place <M>k</M></td></tr>
            <tr><td><M>{t`\tilde m`}</M></td><td>a middle score with popularity evened out (%)</td></tr>
            <tr><td><M>{t`a_b,\ S_b,\ q_b`}</M></td><td>the typical line: its height at <M>c</M> (%), accuracy lost per +1.0 constant (%), and bend</td></tr>
            <tr><td><M>{t`s_b`}</M></td><td>scatter: how far charts sit from the line (%)</td></tr>
            <tr><td><M>{t`\mathrm{se}_a,\ \mathrm{se}_S`}</M></td><td>how sure the line&apos;s height and its rate are</td></tr>
            <tr><td><M>{t`g_b`}</M></td><td>accuracy gap: evened middle score minus typical score (%)</td></tr>
            <tr><td><M>{t`\Delta c_b,\ \Delta c`}</M></td><td>constant gap, per bucket and combined</td></tr>
            <tr><td><M>{t`\epsilon_b,\ \rho_b,\ w_b`}</M></td><td>a bucket&apos;s sample error, rate error, and weight (its say)</td></tr>
            <tr><td><M>{t`\epsilon,\ \rho,\ \delta`}</M></td><td>the result&apos;s sample part, rate part, and how much the buckets disagree</td></tr>
            <tr><td><M>{t`\sigma`}</M></td><td>the result&apos;s uncertainty (constant): the 95% range is <M>{t`\pm 2\sigma`}</M></td></tr>
            <tr><td><M>{t`D,\ \lambda`}</M></td><td>how widely results at <M>c</M> vary, and the scale applied (step 9)</td></tr>
          </tbody>
        </table>
        <table className="pl-table">
          <thead><tr><th>setting</th><th>value</th><th>what it does</th></tr></thead>
          <tbody>
            <tr><td>buckets</td><td>&minus;{BUCKETS_BELOW} to +{BUCKETS_ABOVE}</td><td>groups around the center rating&apos;s group that are used (each weighed by step 7)</td></tr>
            <tr><td><M>W</M></td><td>{W}</td><td>how far either side of <M>c</M> the comparison charts reach</td></tr>
            <tr><td>fewest charts</td><td>{MIN_CHARTS}</td><td>comparison charts a bucket needs</td></tr>
            <tr><td><M>{t`S_{\min}`}</M></td><td>{MIN_RATE}%</td><td>a bucket losing this or less per +1.0 constant can&apos;t tell charts apart and is skipped</td></tr>
            <tr><td><M>{t`s_{\min}`}</M></td><td>{SCATTER_MIN}%</td><td>the lowest scatter allowed</td></tr>
            <tr><td><M>{t`D^{*}`}</M></td><td>{SPREAD_TARGET}</td><td>spread target: how far charts at one constant may differ (step 9), from the site owner&apos;s understanding of the game</td></tr>
            <tr><td><M>r</M></td><td>{SURE_RANGE}</td><td>sure range: a 95% range reaching this far or less either side is sure</td></tr>
            <tr><td><M>K</M></td><td>{CAP}</td><td>the most plays like can move from <M>c</M></td></tr>
            <tr><td><M>{t`c_{\max}`}</M></td><td>{MAX_CONSTANT.toFixed(1)}</td><td>the highest constant</td></tr>
          </tbody>
        </table>
      </details>

      <h2 id="maishift">the steps (the rating bucket method)</h2>
      <p className="pl-hint">click an equation to read it in words, with what each symbol is. the examples tabs above run real charts through every step.</p>

      <Step id="step-1" title="step 1: pick the buckets">
        <Eq tex={t`R = \min\!\Big(50\,\big\lfloor 22.4 \times 1.005 \times \min(c,\ c_{\max}) \big\rfloor,\ 16600\Big)`}
          words={<>center rating = the game&apos;s rating for an SSS+ (100.5%) on a chart of this constant, rounded down, &times; 50, at most 16,600</>}
          vars={[['R', 'the result: center rating, the rating an SSS+ on this chart gives × 50'], ['c', "the chart's constant (song list)"], [t`c_{\max}`, MAX_CONSTANT.toFixed(1)], [t`\lfloor\ \rfloor`, 'round down']]} />
        <Eq tex={t`B = \big\{\, b \;:\; g(R) - ${String(BUCKETS_BELOW)} \;\le\; g(b) \;\le\; g(R) + ${String(BUCKETS_ABOVE)} \,\big\}, \qquad g(x) = \left\lfloor \frac{x}{250} \right\rfloor`}
          words={<>the buckets used are every maishift bucket whose group is at least {BUCKETS_BELOW} groups below the center rating&apos;s group and at most {BUCKETS_ABOVE} groups above it. a group is a 250-wide slice of rating (15,250–15,499 is one)</>}
          vars={[['B', 'the result: every bucket used'], ['b', "one of maishift's buckets: 13,000–13,500, 13,500–14,000, then every 250 up to 17,000"], ['g(x)', 'the group a rating x is in']]} />
        <Why>inside one bucket everyone is about as skilled, so differences between charts come from the charts. no bucket is picked by hand: a bucket where most players are near 101% can still say a chart is easy, but step 7 gives it little say because its scores barely change between constants.</Why>
      </Step>

      <Step id="step-2" title="step 2: middle score from rank counts">
        <Eq tex={t`m_b = L_k + \frac{\tfrac{N_b}{2} - C_{k-1}}{n_k}\,\big(H_k - L_k\big), \qquad C_i = \sum_{r=0}^{i} n_r, \qquad k = \min\big\{\, i : C_i \ge \tfrac{N_b}{2} \,\big\}`}
          words={<>middle score = the low end of the middle player&apos;s rank + (half the players &minus; players in the ranks below it) &divide; players in that rank &times; the rank&apos;s width. with exact scores you&apos;d sort them and take the middle one; maishift only gives rank counts, so this finds the rank the middle player is in and places them inside it as if that rank&apos;s players were spread evenly</>}
          vars={[[t`m_b`, "the result: this chart's middle score in bucket b (%)"], [t`N_b`, "players in the bucket (maishift; players its rank counts miss count as SSS+)"], [t`n_r`, 'players with rank r, from r = 0 (<94) to 8 (AP+)'], [t`C_i`, 'running total of players up to rank i'], ['k', "the middle player's rank: the first where the running total reaches half"], [t`L_k,\ H_k`, "that rank's range: <94 90–94, AAA 94–97, S 97–98, S+ 98–99, SS 99–99.5, SS+ 99.5–100, SSS 100–100.5, SSS+ 100.5–101, AP+ 101"]]} />
        <Eq tex={t`e_b = \frac{\big(H_k - L_k\big)\sqrt{N_b}}{2\,n_k}`}
          words={<>middle score&apos;s error = rank width &times; &radic;players &divide; (2 &times; players in that rank): the usual error of a median from grouped counts (AP+ has no width: 0.5 is used)</>}
          vars={[[t`e_b`, "the result: the middle score's error, how far it could move with a different set of players (%)"], [t`H_k - L_k`, "the middle player's rank's width"], [t`n_k`, 'players in that rank']]} />
        <Why>the middle player stands for the bucket: one AP+ or one fail barely moves it. more players, or more of them in the middle rank, means a steadier middle.</Why>
      </Step>

      <Step id="step-3" title="step 3: build the comparison pool">
        <Eq tex={t`P_b = \big\{\, j \;:\; V_j = V,\ \ |c_j - c| \le W,\ \ N_{b,j} > 0,\ \ j \ne \text{this chart} \,\big\}`}
          words={<>comparison pool = every chart from the same group of versions, within {W} of this constant, with players in this bucket, except this chart</>}
          vars={[[t`P_b`, 'the result: the comparison pool, every chart this one is compared with in bucket b'], ['j', 'one chart in the pool'], [t`V_j,\ V`, 'chart j\'s group of versions, and this chart\'s'], [t`N_{b,j}`, "chart j's players in bucket b"], ['V', <>the group of versions a chart is from: {GROUPS}</>], [t`c_j`, "chart j's constant"], ['W', String(W)]]} />
        <Where>
          <li>at least {MIN_CHARTS} charts; with fewer, the versions just outside the group are added one each side at a time, and a bucket that still has too few is skipped</li>
        </Where>
        <Why>a middle score means nothing alone: it needs what these players usually get on charts like this. newer charts score higher than older ones at the same constant, so only charts from the same group of versions count.</Why>
      </Step>

      <Step id="step-4" title="step 4: even out popularity">
        <Eq tex={t`x_j = \log_2 N_{b,j}, \qquad \bar x_G = \frac{1}{|G|}\sum_{j \in G} x_j, \qquad \bar m_G = \frac{1}{|G|}\sum_{j \in G} m_j`}
          words={<>first, for every chart: its popularity is log&#8322; of its players in the bucket. then, for each set of charts that share a constant, a group of versions and a bucket at the same place, the average popularity and the average middle score of that set</>}
          vars={[[t`x_j`, "the result: chart j's popularity, log₂ of its players (doubling the players adds 1)"], [t`N_{b,j}`, "chart j's players in the bucket"], ['G', 'one set of charts with the same constant, group of versions and bucket'], [t`|G|`, 'how many charts are in the set'], [t`m_j`, "chart j's middle score (step 2) (%)"], [t`\bar x_G`, 'the result: the average popularity of the set'], [t`\bar m_G`, 'the result: the average middle score of the set (%)']]} />
        <Eq tex={t`p_k = \frac{\displaystyle\sum_{G}\ \sum_{j \in G} \big(x_j - \bar x_G\big)\big(m_j - \bar m_G\big)}{\displaystyle\sum_{G}\ \sum_{j \in G} \big(x_j - \bar x_G\big)^2}`}
          words={<>popularity rate for a bucket&apos;s place = how much a chart&apos;s middle score rises, compared with the average of its set, for each step its popularity is above its set&apos;s average (one step = twice the players). measured inside every set, then pooled over all of them</>}
          vars={[[t`p_k`, 'the result: popularity rate for buckets at place k (% per doubling of players)'], [t`x_j - \bar x_G`, "how much more popular chart j is than its set's average"], [t`m_j - \bar m_G`, "how much higher chart j's middle score is than its set's average (%)"], [t`\sum_G \sum_{j \in G}`, 'added up over every chart in every set at this place']]} />
        <Eq tex={t`\tilde m_j = m_j - p_k\,\big(x_j - \bar x\big), \qquad \bar x = \frac{1}{|P_b|}\sum_{j \in P_b} x_j`}
          words={<>evened middle score = middle score &minus; popularity rate &times; (log&#8322; players &minus; the pool&apos;s average log&#8322; players). this chart and every pool chart are evened out the same way</>}
          vars={[[t`\tilde m_j`, "the result: chart j's middle score with popularity evened out (%); this chart's is written with b instead of j"], [t`m_j,\ x_j`, "chart j's middle score and popularity"], [t`\bar x`, "the result: the pool's average popularity"], [t`|P_b|`, 'how many charts are in the pool']]} />
        <div className="wx-counts">
          <table>
            <thead><tr><th>bucket&apos;s place <M>k</M></th>{[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => <th key={k}>{k === -5 ? '−5 or lower' : k === 4 ? '+4 or higher' : k > 0 ? `+${k}` : k}</th>)}</tr></thead>
            <tbody><tr><th><M>{t`p_k`}</M> (% per doubling)</th>{[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => <td key={k}>{pop[String(k)]?.toFixed(2)}</td>)}</tr></tbody>
          </table>
          <span className="wx-from">measured from maishift&apos;s data ({WORKED_EXAMPLES.kisukitsune.fetched}); smaller in high buckets, where players are already near 101%</span>
        </div>
        <Why>charts more people play get more practice, which raises best scores for reasons other than difficulty. maishift gives best scores, not plays, so player count stands in for popularity. measured once from every chart, the rate is steady, and it works both ways: more players than usual lowers a chart, fewer raises it. the data shows the pattern but can&apos;t say why: some of it may be easy charts attracting more players, so this may take out a little real easiness.</Why>
      </Step>

      <Step id="step-5" title="step 5: fit the typical line">
        <Eq tex={t`\tilde m_j \approx a_b - S_b\, d_j + q_b\, d_j^{\,2}, \qquad d_j = c_j - c`}
          words={<>a chart&apos;s evened middle score &asymp; typical score &minus; accuracy per +1.0 constant &times; constant difference + bend &times; constant difference&sup2;</>}
          vars={[[t`\tilde m_j`, "chart j's evened middle score (step 4)"], [t`a_b`, 'typical score: the line at this constant (%)'], [t`S_b`, 'accuracy lost per +1.0 constant (%)'], [t`q_b`, 'bend: the line flattens toward 101%'], [t`d_j`, "chart j's constant minus this chart's"]]} />
        <Eq tex={t`(a_b,\ S_b,\ q_b) = \arg\min \sum_{j \in P_b} \Big(\tilde m_j - a_b + S_b\, d_j - q_b\, d_j^{\,2}\Big)^2`}
          words={<>the three values that make the line miss the pool&apos;s evened scores least (the smallest total of squared misses). a bucket whose <M>{t`S_b`}</M> comes out {MIN_RATE} or less is skipped</>}
          vars={[[t`a_b,\ S_b,\ q_b`, 'the result: the typical line for bucket b'], [t`\arg\min`, 'the values that make what follows smallest']]} />
        <PlaysLikeFitGraph example={WORKED_EXAMPLES.kisukitsune} />
        <details className="pl-more">
          <summary>how to find the fit yourself</summary>
          <p>with <M>{t`\beta_0 = a_b,\ \beta_1 = -S_b,\ \beta_2 = q_b`}</M>, solve these three equations together:</p>
          <Tex block>{t`\begin{pmatrix} |P_b| & \sum\limits_{j} d_j & \sum\limits_{j} d_j^2 \\ \sum\limits_{j} d_j & \sum\limits_{j} d_j^2 & \sum\limits_{j} d_j^3 \\ \sum\limits_{j} d_j^2 & \sum\limits_{j} d_j^3 & \sum\limits_{j} d_j^4 \end{pmatrix} \begin{pmatrix} \beta_0 \\ \beta_1 \\ \beta_2 \end{pmatrix} = \begin{pmatrix} \sum\limits_{j} \tilde m_j \\ \sum\limits_{j} d_j \tilde m_j \\ \sum\limits_{j} d_j^2 \tilde m_j \end{pmatrix}, \qquad j \in P_b`}</Tex>
          <p className="pl-why">each row: (first &times; <M>{t`\beta_0`}</M>) + (second &times; <M>{t`\beta_1`}</M>) + (third &times; <M>{t`\beta_2`}</M>) = the number on the right. in a spreadsheet, =LINEST(evened score column, the d and d&sup2; columns, TRUE, TRUE) gives <M>{t`q_b`}</M>, <M>{t`-S_b`}</M>, <M>{t`a_b`}</M> and, in its second row, their errors.</p>
        </details>
        <Eq tex={t`s_b = \max\!\left(\sqrt{\frac{1}{|P_b| - 3}\displaystyle\sum_{j \in P_b}\big(\tilde m_j - \hat m_j\big)^2},\ s_{\min}\right), \qquad \hat m_j = a_b - S_b\, d_j + q_b\, d_j^{\,2}`}
          words={<>scatter = how far the pool&apos;s charts sit from the line: the square root of the average squared miss (dividing by charts &minus; 3, for the three fitted values), at least {SCATTER_MIN}%</>}
          vars={[[t`s_b`, 'the result: scatter, how far charts sit from the line in bucket b (%)'], [t`\hat m_j`, "the line's value at chart j"], [t`s_{\min}`, `${SCATTER_MIN}%`]]} />
        <Eq tex={t`\mathrm{se}_a = s_b\sqrt{\big[(X^{\top}X)^{-1}\big]_{11}}, \qquad \mathrm{se}_S = s_b\sqrt{\big[(X^{\top}X)^{-1}\big]_{22}}`}
          words={<>the errors of the typical score and of the rate: scatter &times; &radic;(the matching diagonal entry of the inverse of the left-hand table above), the standard least-squares errors</>}
          vars={[[t`\mathrm{se}_a`, "the result: the typical score's error (%)"], [t`\mathrm{se}_S`, "the result: the rate's error (% per +1.0 constant)"], [t`X^{\top}X`, 'the left-hand table in "how to find the fit yourself"'], [t`[\ ]_{11},\ [\ ]_{22}`, 'its first and second diagonal entries after inverting']]} />
        <Why>this is what a normal chart at <M>c</M> gets, so there&apos;s something to compare against, and how much +1.0 constant is worth in accuracy for these players. the errors say how well it&apos;s pinned down: more charts and less scatter, smaller errors.</Why>
      </Step>

      <Step id="step-6" title="step 6: this chart's gap">
        <Eq tex={t`g_b = \tilde m_b - a_b`} words={<>accuracy gap = this chart&apos;s evened middle score &minus; typical score. + means players do better here: easier</>}
          vars={[[t`g_b`, 'the result: accuracy gap in bucket b (%)'], [t`\tilde m_b`, "this chart's evened middle score (step 4)"], [t`a_b`, 'typical score (step 5)']]} />
        <Why>the real &ldquo;easier or harder&rdquo; signal, in accuracy.</Why>
      </Step>

      <Step id="step-7" title="step 7: turn it into constant, and weigh it">
        <Eq tex={t`\Delta c_b = \frac{g_b}{S_b}`} words={<>constant gap = accuracy gap &divide; accuracy per +1.0 constant</>}
          vars={[[t`\Delta c_b`, 'the result: constant gap in bucket b (+ easier)'], [t`g_b`, 'accuracy gap (step 6)'], [t`S_b`, 'accuracy per +1.0 constant (step 5)']]} />
        <Eq tex={t`\epsilon_b = \frac{\sqrt{e_b^2 + \mathrm{se}_a^2}}{S_b}, \qquad \rho_b = \frac{|\Delta c_b|\,\mathrm{se}_S}{S_b}, \qquad w_b = \frac{1}{\epsilon_b^2 + \rho_b^2}`}
          words={<>sample error = how far the middle score and the typical score could be off, together, in constant. rate error = how far the constant gap moves if the rate is off. weight = 1 &divide; (sample error&sup2; + rate error&sup2;)</>}
          vars={[[t`\epsilon_b`, 'the result: sample error (constant)'], [t`\rho_b`, 'the result: rate error (constant)'], [t`w_b`, "the result: the bucket's weight, its say in step 8"], [t`e_b`, "middle score's error (step 2)"], [t`\mathrm{se}_a,\ \mathrm{se}_S`, 'errors of the typical score and the rate (step 5)']]} />
        <Why>players care about constant, not percent; each bucket uses its own rate. a bucket&apos;s say comes from its own evidence: enough players, a well-pinned line, and scores that actually change with constant. where most players are near 101%, <M>{t`S_b`}</M> is tiny, so dividing by it makes the errors big and the say small.</Why>
      </Step>

      <Step id="step-8" title="step 8: combine the buckets">
        <Eq tex={t`\Delta c = \frac{\displaystyle\sum_{b \in B} w_b\, \Delta c_b}{\displaystyle\sum_{b \in B} w_b}`} words={<>constant gap = (each bucket&apos;s weight &times; its constant gap, added up) &divide; (every weight added up)</>}
          vars={[[t`\Delta c`, "the result: this chart's constant gap, all buckets together (+ easier)"], [t`\sum_{b \in B}`, 'added up over every bucket used (step 1)']]} />
        <Eq tex={t`\sigma = \sqrt{\epsilon^2 + \rho^2 + \delta^2}, \qquad \epsilon = \Big(\sum_{b \in B} \epsilon_b^{-2}\Big)^{-1/2}, \qquad \rho = \frac{\displaystyle\sum_{b \in B} w_b\, \rho_b}{\displaystyle\sum_{b \in B} w_b}, \qquad \delta = \sqrt{\frac{\displaystyle\sum_{b \in B} w_b\,(\Delta c_b - \Delta c)^2}{(|B| - 1)\displaystyle\sum_{b \in B} w_b}}`}
          words={<>uncertainty = &radic;(sample part&sup2; + rate part&sup2; + disagreement&sup2;). the sample part shrinks as buckets are added (different players in each); the rate part is a weighted average, not shrunk (every bucket&apos;s rate could be off the same way); the disagreement says how far the buckets&apos; answers spread around the combined one (one bucket alone counts as {SINGLE_BUCKET_DISAGREE})</>}
          vars={[[t`\sigma`, "the result: this chart's uncertainty (constant)"], [t`\epsilon`, 'the result: sample part'], [t`\rho`, 'the result: rate part'], [t`\delta`, 'the result: disagreement between buckets'], [t`|B|`, 'how many buckets']]} />
        <Why>one bucket alone could be a fluke; agreement across skill levels is more convincing. three separate ways to be off combine by squaring, adding and taking the root.</Why>
      </Step>

      <Step id="step-9" title="step 9: fit to the level">
        <Eq tex={t`D = 1.4826 \cdot \operatorname*{median}_{i \in Q_c} \Big|\, \Delta c_i - \operatorname*{median}_{i \in Q_c} \Delta c_i \,\Big|, \qquad \lambda = \min\!\Big(1,\ \frac{D^{*}}{D}\Big)`}
          words={<>spread = how widely step 8&apos;s results vary among every chart at this constant that isn&apos;t hidden (1.4826 &times; the median distance from the median, so outliers barely count). scale = spread target &divide; spread, at most 1. with fewer than {SPREAD_MIN_CHARTS} charts at <M>c</M>, the constants next to it are added</>}
          vars={[['D', 'the result: the spread of results at this constant'], [t`\lambda`, 'the result: the scale'], [t`Q_c`, 'every maishift chart at this constant whose result isn\'t hidden'], [t`\Delta c_i`, "chart i's constant gap (step 8)"], [t`D^{*}`, `spread target, ${SPREAD_TARGET}`]]} />
        <Eq tex={t`\Delta c' = \lambda\,\Delta c, \qquad \sigma' = \lambda\,\sigma`} words={<>constant gap and uncertainty are both multiplied by the scale</>}
          vars={[[t`\Delta c'`, 'the result: the constant gap, fitted to the level'], [t`\sigma'`, 'the result: the uncertainty, fitted to the level']]} />
        <Where>
          <li>example: at 13.4 results spread 0.43, so the scale is 0.25 &divide; 0.43 = 0.58, and 天国と地獄 MASTER&apos;s &minus;0.32 becomes &minus;0.18 (plays like 13.6). from 13.5 up the spread is already about 0.2, so nothing changes</li>
        </Where>
        <Why><b>based on the site owner&apos;s understanding of the game:</b> each step in constant is felt, and within one constant charts feel at most about 0.3 to 0.5 apart. below 13.5 the raw method sees differences of a whole level, which isn&apos;t believable, so its scale is shrunk to fit while keeping which charts are easier or harder. a spread of {SPREAD_TARGET} puts about 95% of charts within 0.5 and 80% within 0.3.</Why>
      </Step>

      <Step id="step-10" title="step 10: how sure?">
        <Eq tex={t`\text{plays like} = \min\!\Big(c_{\max},\ \operatorname{round}_{0.1}\!\big(c - \operatorname{clamp}(\Delta c',\, -K,\, K)\big)\Big), \qquad \text{range} = c - \big(\Delta c' \pm 2\sigma'\big)`}
          words={<>plays like = constant &minus; constant gap (held within &plusmn;{CAP}), rounded to 0.1, at most {MAX_CONSTANT.toFixed(1)}; the 95% range is the same with the constant gap &plusmn; 2 &times; uncertainty</>}
          vars={[[t`\text{plays like}`, 'the result shown on the song page'], [t`\text{range}`, 'the result: the 95% range, shown with it'], [t`\operatorname{clamp}(x, -K, K)`, `x held between −${CAP} and +${CAP}`], ['K', String(CAP)], [t`\operatorname{round}_{0.1}`, 'round to the nearest 0.1']]} />
        <Eq tex={t`\text{status} = \begin{cases} \text{sure} & 2\sigma' \le r \\ \text{uncertain} & 2\sigma' > r \ \text{and}\ |\Delta c'| > 2\sigma' \\ \text{hidden} & \text{otherwise} \end{cases}`}
          words={<>sure if the 95% range reaches no more than {SURE_RANGE} either side; otherwise shown marked uncertain if it clearly leans one way (the whole range is on one side of the constant); otherwise hidden</>}
          vars={[[t`\text{status}`, 'the result: sure, uncertain (shown with an amber label) or hidden'], ['r', String(SURE_RANGE)]]} />
        <Why>the true answer is inside the 95% range 19 times out of 20. a chart with many players and buckets that agree gets a narrow range; few players or mixed signals, a wide one. the song page shows the range, so players know how much to trust the number, and nothing at all when it can&apos;t even tell which way the chart leans.</Why>
      </Step>

      <h2 id="old-method">limits</h2>
      <ul className="pl-limits">
        <li><b>step 9 is a judgement:</b> it trusts the method for which charts are easier or harder, and the site owner&apos;s understanding of the game for how much. the uncertainty is scaled too, so low-level results look surer than the raw numbers alone would say.</li>
        <li><b>the rate in step 5:</b> below 13.5, scores change much less per +1.0 constant and same-constant charts spread about three times as widely as above. the cause isn&apos;t known yet (players far above the chart grinding more or less, coarse ranks at the bottom, or the data); step 9 covers it for now.</li>
        <li><b>what the uncertainty can&apos;t catch:</b> it says how well the result is known if the method is right; a rate that&apos;s off everywhere wouldn&apos;t show in it.</li>
        <li><b>best scores, not plays:</b> maishift gives each player&apos;s best rank, not how often they played, so practice can only be guessed from player counts (step 4).</li>
        <li><b>middle score, not SSS+:</b> a chart can be easy to score well on but hard to max out; plays like follows the middle player. the middle score also assumes players are spread evenly inside a rank.</li>
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
        of the same constant, turned into constant with a measured rate, with a 95% range that says how sure it is. it&apos;s worked out by the rating bucket method, from maishift&apos;s data.
      </p>
      <div className="pl-headline">plays like = constant &minus; (accuracy gap &divide; accuracy per +1.0 constant)</div>
      <PlaysLikeTabs tabs={[
        { id: 'method', label: 'the rating bucket method', content: <Method /> },
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
  .pl-eq-math { overflow-x: auto; min-width: 0; }
  .pl-eq-math math[display="block"] { margin: 0.2rem 0; text-align: left; font-size: 1.12em; }
  .pl-page .tex math { color: var(--text-main); }
  .pl-eq-words p { margin: 0 0 0.3rem; }
  .pl-more math[display="block"] { overflow-x: auto; margin: 0.5rem 0; }
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
    .wx-input { grid-template-columns: 1fr; gap: 0; }
  }
`;
