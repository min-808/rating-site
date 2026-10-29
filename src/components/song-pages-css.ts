/**
 * Styles for the searchable song list (sg-, SongBrowser.tsx and /songs). One string, drawn
 * in a <style> tag. Colors come from the site's theme variables, so both themes work. A
 * song's own page has its own file: song-detail-css.ts.
 */
export const songPagesCss = `
  .sg-main { max-width: 1000px; margin: 0 auto; padding: 0 1rem 2rem; font-family: sans-serif; color: var(--text-main); }
  .sg-main h1 { margin: 0.5rem 0 0.25rem; font-size: 1.6rem; }
  .sg-sub { margin: 0 0 1rem; color: var(--text-muted); font-size: 0.9rem; }

  /* ============ LIST: search + filters ============ */
  .sg-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 0.75rem; }
  .sg-search { grid-column: 1 / -1; }
  .sg-input, .sg-select { width: 100%; box-sizing: border-box; font: inherit; font-size: 0.9rem; padding: 8px 10px;
    border-radius: 8px; border: 1px solid var(--border-strong); background: transparent; color: inherit; }
  .sg-input:focus, .sg-select:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .sg-select option { background: var(--bg-color); color: var(--text-main); }
  .sg-bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 0 0 0.75rem; font-size: 0.82rem; color: var(--text-muted); }
  .sg-reset { font: inherit; font-size: 0.82rem; background: none; border: none; color: #2563eb; cursor: pointer; padding: 0; }

  /* ============ LIST: song cards ============ */
  .sg-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 10px; }
  .sg-item { position: relative; }
  .sg-link { position: relative; overflow: hidden; display: flex; gap: 12px; padding: 10px; border: 1px solid var(--border-light); border-radius: 10px;
    text-decoration: none; color: inherit; background: var(--btn-bg); height: 100%; box-sizing: border-box; }
  .sg-link:hover { border-color: var(--border-strong); }
  /* the jacket, very faded, across the whole card: strongest on the right, fading out behind the small jacket */
  .sg-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.2; pointer-events: none; transform: scale(1.08);
    -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0.25) 0%, #000 70%); mask-image: linear-gradient(90deg, rgba(0,0,0,0.25) 0%, #000 70%); }
  .sg-link:hover .sg-bg { opacity: 0.28; }
  .sg-jacket { position: relative; width: 76px; height: 76px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: var(--border-light);
    display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 1.6rem; }
  .sg-jacket img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sg-info { position: relative; min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; padding-right: 30px; }
  .sg-name { margin: 0; font-weight: 700; font-size: 0.95rem; line-height: 1.25; overflow-wrap: anywhere; }
  .sg-artist { margin: 0; font-size: 0.78rem; color: var(--text-muted); overflow-wrap: anywhere; }
  .fh.sg-heart { position: absolute; top: 6px; right: 6px; z-index: 2; } /* .fh.: beats the heart's own position: relative */

  /* every chart: a row for standard, a row for DX */
  .sg-pills { display: grid; gap: 4px; margin-top: auto; padding-top: 6px; }
  .sg-pillrow { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
  .sg-kind { width: 1.5rem; flex-shrink: 0; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.04em; color: var(--text-muted); }
  .sg-pill { font-size: 0.68rem; font-weight: 800; padding: 1px 7px; border-radius: 999px; color: #fff; white-space: nowrap; transition: opacity 0.12s, filter 0.12s; }
  /* when the search picked a difficulty, level or type: found charts stand out, the others step back */
  .sg-pill.is-hit { box-shadow: 0 0 0 2px var(--bg-color), 0 0 0 4px var(--text-main); }
  .sg-pill.is-dim { opacity: 0.25; filter: saturate(0.4); }
  .sg-more { display: block; margin: 1rem auto 0; font: inherit; padding: 8px 22px; border-radius: 8px; cursor: pointer;
    background: var(--btn-bg); color: var(--btn-text); border: 1px solid var(--btn-border); }
  .sg-empty { text-align: center; color: var(--text-muted); font-style: italic; padding: 2rem 0; }

  /* PILL TEXT, CENTERED. Where capitals and digits sit inside a line of text depends on the
     font (0 to ~0.12em too high in the fonts measured, worse when a character falls back to
     another font: ＆ ™ kana ✓). text-box-trim cuts that built-in space off, so the text is
     centered in the pill whatever font draws it. The padding is restated in em to keep each
     pill the size it was. Browsers without text-box-trim keep the rules above unchanged. */
  @supports (text-box-trim: trim-both) {
    .sg-pill { display: inline-block; padding: 0.34em 0.65em; text-box-trim: trim-both; text-box-edge: cap alphabetic; }
  }
`;
