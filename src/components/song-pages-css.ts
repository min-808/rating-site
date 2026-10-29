/**
 * Styles for the searchable song list (sg-, SongBrowser.tsx and /charts). One string, drawn
 * in a <style> tag. Colors come from the site's theme variables, so both themes work. A
 * song's own page has its own file: song-detail-css.ts.
 */
export const songPagesCss = `
  .sg-main { max-width: 1000px; margin: 0 auto; padding: 0 1rem 2rem; font-family: sans-serif; color: var(--text-main); }
  /* same heading and subtitle as the leaderboard's (app/page.tsx) */
  .sg-main h1 { margin: 0.67em 0 0.25rem; font-size: 2em; }
  .sg-title-end { white-space: nowrap; }
  .sg-title-icon { display: inline-block; height: 1em; width: auto; margin-left: 0.35em; vertical-align: -0.12em;
    -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-drag: none; }
  .sg-title-icon.is-jumping { animation: sg-icon-jump 0.5s ease-out; }
  @keyframes sg-icon-jump {
    0%, 100% { transform: translateY(0); }
    30%      { transform: translateY(-0.3em); }
    50%      { transform: translateY(0); }
    65%      { transform: translateY(-0.1em); }
    80%      { transform: translateY(0); }
  }
  .sg-updated { margin: 0 0 1.5rem; font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; }

  /* ============ LIST: search + filters ============ */
  /* one panel, like osu!'s beatmap listing: the search box, a row per filter, the sort bar */
  .sg-panel { border: 1px solid var(--border-light); border-radius: 12px; background: var(--btn-bg); margin-bottom: 0.9rem; overflow: hidden; }
  .sg-searchbox { display: flex; align-items: center; gap: 10px; margin: 14px 14px 6px; padding: 0 14px; border-radius: 10px;
    border: 1px solid var(--border-strong); color: var(--text-muted); cursor: text; }
  .sg-searchbox:focus-within { border-color: #2563eb; box-shadow: 0 0 0 1px #2563eb; }
  .sg-input { flex: 1; min-width: 0; font: inherit; font-size: 1rem; padding: 11px 0; border: none; background: transparent; color: var(--text-main); outline: none; }

  .sg-rows { display: grid; gap: 8px; padding: 10px 14px 14px; }
  .sg-row { display: grid; grid-template-columns: 96px 1fr; align-items: start; gap: 8px; }
  .sg-row-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; color: var(--text-muted); padding: 7px 0 0; white-space: nowrap; }
  /* the options: quiet outlined pills. the picked one is filled with the text color (or its
     difficulty's color), so it stands out without a link color */
  .sg-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .sg-chip { font: inherit; font-size: 0.8rem; font-weight: 600; line-height: 1; padding: 6px 11px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--border-light); background: transparent; color: var(--text-muted);
    display: inline-flex; align-items: center; gap: 6px; transition: background 0.12s, color 0.12s, border-color 0.12s; }
  .sg-chip:hover { color: var(--text-main); border-color: var(--border-strong); }
  .sg-chip.is-on { color: var(--bg-color); background: var(--text-main); border-color: var(--text-main); font-weight: 800; }
  .sg-chip.has-color::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--chip); }
  .sg-chip.has-color.is-on { color: #fff; background: var(--chip); border-color: var(--chip); }
  .sg-chip.has-color.is-on::before { background: #fff; }
  .sg-chip-gap { width: 10px; } /* sets "could raise my rating" a little apart from played / unplayed */
  /* "older versions": a plain text button after the options, not one of them */
  .sg-chip-more { font: inherit; font-size: 0.8rem; font-weight: 600; padding: 6px 4px; border: none; background: none; cursor: pointer;
    color: var(--text-muted); text-decoration: underline; text-underline-offset: 3px; }
  .sg-chip-more:hover { color: var(--text-main); }
  .sg-chip-more:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
  .sg-chip:focus-visible, .sg-sort:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }

  .sg-sortbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 8px 14px; border-top: 1px solid var(--border-light);
    background: rgba(127,127,127,0.07); }
  .sg-sortbar .sg-row-label { width: 96px; margin-right: 8px; }
  .sg-sort { font: inherit; font-size: 0.85rem; padding: 6px 14px; border-radius: 8px; border: none; background: none; cursor: pointer; color: var(--text-muted); }
  .sg-sort:hover { color: var(--text-main); }
  .sg-sort.is-on { font-weight: 800; color: var(--text-main); background: rgba(127,127,127,0.18); }
  .sg-sort-dir { margin-left: 6px; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }

  .sg-filters-toggle { display: none; }

  /* phones: each label sits above its options, and the rows fold away behind "filters" */
  @media (max-width: 600px) {
    .sg-filters-toggle { display: block; margin: 4px 14px 10px; font: inherit; font-size: 0.85rem; font-weight: 700; padding: 0; border: none;
      background: none; color: #3b82f6; cursor: pointer; }
    .sg-rows:not(.is-open) { display: none; }
    .sg-rows { padding-top: 0; }
    .sg-row { grid-template-columns: 1fr; gap: 0; }
    .sg-row-label { padding: 0 0 4px; }
    .sg-sortbar .sg-row-label { width: 100%; margin: 0; }
  }
  .sg-bar { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin: 0 0 0.75rem; font-size: 0.82rem; color: var(--text-muted); }
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
