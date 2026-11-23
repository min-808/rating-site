import katex from 'katex';

/**
 * A formula written in TeX, drawn by the browser as MathML (KaTeX, output: 'mathml'), so it needs
 * no extra fonts or stylesheet: sums with their limits under them, fractions, roots. Renders on the
 * server. block: a display formula on its own line.
 */
export default function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = katex.renderToString(children, { output: 'mathml', displayMode: block, throwOnError: false, strict: false });
  return <span className={block ? 'tex tex-block' : 'tex'} dangerouslySetInnerHTML={{ __html: html }} />;
}
