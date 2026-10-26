/**
 * The best 50 cards' styles: the cards, the section headings, the search box and the song
 * popup. One string, drawn in a <style> tag by BestFifty and by the favorite scores row
 * (FavoriteScores.tsx), which is why it lives in its own file. BestFifty.tsx re-exports it,
 * so existing imports of bestFiftyCss from there keep working.
 *
 * Plain module (no 'use client'). Rules are grouped under "=====" comment headings.
 */
export const bestFiftyCss = `
  /* page, header, sections, grid */
  .bf-wrap { padding: 0 2rem 2rem 2rem; max-width: 1000px; margin: 0 auto; font-family: sans-serif; }
  .bf-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.25rem 1rem; }
  .bf-head h1 { margin: 0.5rem 0; }
  .bf-sub-total { color: var(--text-sub); font-size: 0.85rem; }
  .bf-section { display: flex; align-items: baseline; gap: 0.75rem; margin: 1.5rem 0 0.75rem; }
  /* B15 / B35: between the card's small label and the cards themselves in size */
  .bf-section h2 { margin: 0; font-size: 1.15rem; }
  .bf-section > span { font-size: 0.72rem; color: var(--text-sub); }
  .bf-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .bf-empty { color: var(--text-muted); font-size: 0.85rem; }

    /* ============ CARD ============ */
  .bf-card { position: relative; isolation: isolate; display: flex; flex-direction: column; width: 100%;
    min-width: 0; padding: 0; overflow: hidden; text-align: left; font: inherit; color: #fff;
    background: #141416; border: none; border-radius: 12px; cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
  .bf-card:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.45); }
  .bf-card:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

  .bf-art-wrap { position: relative; aspect-ratio: 1 / 1.02; width: 100%; overflow: hidden; }
  .bf-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .bf-dim { position: absolute; inset: 0; background: rgba(0,0,0,0.45); }

  .bf-rating-badge { position: absolute; top: 0; right: 0; padding: 5px 10px 5px 12px;
    background: linear-gradient(135deg, #b768d6, #de7cce); color: #fff; font-weight: 800;
    font-size: 1.15rem; line-height: 1; border-radius: 0 12px 0 12px; text-shadow: 0 1px 2px rgba(0,0,0,0.35);
    font-variant-numeric: tabular-nums; }

  /* top-right corner: the level badge, with the "new" banner hanging underneath it */
  .bf-corner { position: absolute; top: 0; right: 0; display: flex; flex-direction: column;
    align-items: flex-end; gap: 3px; }

  /* top-right badge: the chart's difficulty value, in the difficulty color */
  .bf-level-badge { padding: 5px 10px 5px 12px;
    background: var(--diff); color: #fff; font-weight: 800; font-size: 1.1rem; line-height: 1;
    border-radius: 0 12px 0 12px; text-shadow: 0 1px 2px rgba(0,0,0,0.65);
    box-shadow: 0 1px 4px rgba(0,0,0,0.35); font-variant-numeric: tabular-nums; }

  /* Re:MASTER only: lavender-to-pink from the in-game result header, pale edge, navy text outline */
  .bf-level-remaster { background: linear-gradient(135deg, #c592e0 0%, #b96de4 45%, #ff50b9 100%);
    text-shadow: 0 0 3px #2a3679, 0 1px 2px #2a3679;
    box-shadow: 0 1px 4px rgba(0,0,0,0.35), inset 0 0 0 1px #ffebff; }
    
  /* text block over the bottom of the art: 3 rows.
   padding-top sets how tall the fade zone is; the stops set how fast it goes dark. */
  .bf-overlay { position: absolute; left: 0; right: 0; bottom: 0; padding: 10px 6px 4px;
    display: flex; flex-direction: column; gap: 1px;
    background: linear-gradient(to top,
      rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 15%, rgba(0,0,0,0.70) 30%,
      rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.2) 95%, rgba(0,0,0,0) 100%); }
  .bf-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; }
  .bf-rating { font-size: 1.3rem; font-weight: 800; color: #fff; line-height: 1.1;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8); font-variant-numeric: tabular-nums; }
  .bf-ach { font-size: 0.85rem; font-weight: 700; color: #e9e9e9; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bf-title { flex: 1; min-width: 0; font-size: 0.78rem; font-weight: 700;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
  .bf-kind-row { display: flex; justify-content: flex-end; margin-top: 2px; }

  .bf-tag { font-size: 0.68rem; font-weight: 800; padding: 1px 6px; border-radius: 4px; flex-shrink: 0; }

  /* rank colors build up: red/pink (A to AAA), gold (S to SS+), rainbow (SSS, SSS+) */
  .bf-none { background: rgba(255,255,255,0.18); color: #fff; }
  .bf-r-a    { background: #f4a7bd; color: #4a0f22; }
  .bf-r-aa   { background: #e0527f; color: #fff; }
  .bf-r-aaa  { background: linear-gradient(135deg, #d92d4a, #e8407a); color: #fff;
               box-shadow: 0 0 6px rgba(232,64,122,0.55); }
  .bf-r-s    { background: #d9b45a; color: #3b2a00; }
  .bf-r-sp   { background: #e6c04a; color: #3b2a00; }
  .bf-r-ss   { background: linear-gradient(135deg, #f5d04a, #e0a51f); color: #3b2500;
               box-shadow: 0 0 6px rgba(245,208,74,0.5); }
  .bf-r-ssp  { background: linear-gradient(135deg, #fff0a0, #f5c531 45%, #e09a12); color: #3b2500;
               box-shadow: 0 0 0 1px rgba(255,243,176,0.8), 0 0 9px rgba(255,214,80,0.75); }
  .bf-r-sss  { background: linear-gradient(135deg, #fffdf2, #ffeeb0 45%, #f5d56e); color: #4a3200;
             box-shadow: 0 0 0 1px rgba(255,252,230,0.95), 0 0 10px rgba(255,236,160,0.85); }
  .bf-r-sssp { color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.7);
             background: linear-gradient(90deg, #ff5a5a, #ffb84d, #f2e85a, #5cd67f, #4db8ff, #a06bff);
             box-shadow: 0 0 0 1px rgba(255,255,255,0.85), 0 0 10px rgba(255,255,255,0.5); }
  .bf-kind { background: rgba(255,255,255,0.16); color: #fff; }

  /* a chart whose score is from the japanese version (lib/jp-scores.ts): the version band
     splits, a red "JAPAN" on the left, so the card stays the same height as the others */
  .bf-version-band.bf-version-split { display: flex; padding: 0; }
  .bf-version-split > span { padding: 3px 6px; }
  .bf-jp-part { flex-shrink: 0; background: #bc002d; color: #fff; letter-spacing: 0.08em; }
  .bf-jp-part:only-child { flex: 1; } /* no version to show: the whole band */
  .bf-version-split > .bf-version-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bf-version-band { text-align: center; font-size: 0.68rem; font-weight: 800; padding: 3px 6px;
    color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
  .bf-version-band img { max-width: 100%; max-height: 1.2rem; object-fit: contain; }

  /* ============ POPUP ============ */
  .bf-dialog { width: min(480px, calc(100vw - 2rem)); padding: 0; border: 1px solid #232326;
    border-radius: 14px; background: #0e0e10; color: #fff; font-family: sans-serif; }
  .bf-dialog::backdrop { background: rgba(0,0,0,0.6); }
  .bf-dlg { position: relative; padding: 1.1rem; }
  .bf-dlg-x { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; background: transparent; border: none;
    color: #cfcfcf; cursor: pointer; }
  .bf-dlg-x:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .bf-dlg-head { display: flex; gap: 0.9rem; align-items: flex-start; margin-bottom: 0.85rem; padding-right: 26px; }
  .bf-dlg-art { width: 116px; height: 116px; object-fit: cover; border-radius: 8px; flex-shrink: 0;
    box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
  .bf-dlg-info { min-width: 0; }
  .bf-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 0.5rem; }
  .bf-chip { font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 5px;
    background: #1c1c1f; color: #cfcfcf; border: 1px solid #2c2c30; }
  .bf-chip-version { border: none; color: #fff; }
  .bf-chip-diff { background: var(--diff); color: #fff; border: none; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); }
  .bf-dlg-title { margin: 0 0 0.3rem; font-size: 1.25rem; font-weight: 800; overflow-wrap: anywhere; }
  .bf-dlg-artist { margin: 0; font-size: 0.8rem; color: #9a9a9e; }
  .bf-dlg-artist + .bf-dlg-artist { margin-top: 0.8rem; }
  .bf-divider { height: 1px; background: #232326; margin: 0.85rem 0; }
  .bf-score { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 0 0.4rem; }
  .bf-rank-pill { font-size: 0.85rem; font-weight: 800; padding: 4px 12px; border-radius: 999px; }
  .bf-big { font-size: 1.8rem; font-weight: 800; font-variant-numeric: tabular-nums; }
  .bf-big small { font-size: 1.02rem; color: #b7b7bb; font-weight: 700; }
  .bf-dxscore { margin: 0 0 0.25rem; font-size: 0.85rem; color: #cfcfcf; font-variant-numeric: tabular-nums; }
  .bf-dlg-meta { margin: 0 0 0.2rem; font-size: 0.75rem; color: #7a7a7e; }
  .bf-next { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; margin: 0.6rem 0 0.2rem;
    padding: 8px 10px; border-radius: 9px; background: #16161a; border: 1px solid #232326; font-size: 0.8rem; color: #cfcfcf; }
  .bf-next-label { color: #9a9a9e; font-weight: 700; }
  .bf-next-need, .bf-next-rating { font-variant-numeric: tabular-nums; }
  .bf-next-gain { font-weight: 800; color: #82ff9f; font-variant-numeric: tabular-nums; }
  .bf-next-max { color: #9a9a9e; font-style: italic; }
  .bf-icon-row { display: flex; gap: 10px; margin-top: 0.6rem; }
  .bf-icon-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;
    border-radius: 9px; background: #19191c; border: 1px solid #2a2a2e; color: #e5484d; }
  .bf-icon-btn:hover { background: #212124; }

  .bf-card-badges { position: absolute; top: 0px; left: 3px; display: flex; gap: 3px; }
  .bf-card-badges img { height: 38px; width: auto; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }

  .bf-dlg-badges { display: inline-flex; gap: 6px; align-items: center; }
  .bf-dlg-badges img { height: 38px; width: auto; }

  .bf-rank-img { height: 26px; width: auto; flex-shrink: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }
  .bf-dlg-rank-img { height: 34px; width: auto; }

  .bf-next-rank-img { height: 24px; width: auto; flex-shrink: 0; }

  .bf-card-badges { position: absolute; top: 0; left: 3px; display: flex; gap: 3px; isolation: isolate; }
  .bf-card-badges img { height: 38px; width: auto;
    filter: drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.85)); }

  .bf-card-badges::before { content: ''; position: absolute; z-index: -1; inset: -4px -24px -18px -8px;
    background: radial-gradient(ellipse at top left, rgba(0,0,0,0.6), transparent 70%); pointer-events: none; }

  .bf-card-badges img { height: 38px; width: auto;
    filter: saturate(1.15) brightness(1.05)
          drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.85)); }

  .bf-rank-img { height: 26px; width: auto; flex-shrink: 0;
    filter: drop-shadow(0 0 1px rgba(255,255,255,0.8)) drop-shadow(0 2px 3px rgba(0,0,0,0.85)); }

  .bf-dlg-badges img, .bf-dlg-rank-img { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6)); }

  @media (max-width: 600px) {
    .bf-wrap { padding: 0 0.5rem 1rem 0.5rem; }
    .bf-section { flex-wrap: wrap; }
    .bf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
  }

  /* expand / collapse button for the tied charts */
  .bf-extra-toggle { display: flex; align-items: center; gap: 6px; margin: 0.75rem auto 0; padding: 6px 14px;
    border-radius: 999px; border: 1px solid var(--border-light); background: transparent;
    color: var(--text-sub); font: inherit; font-size: 0.8rem; cursor: pointer; }
  .bf-extra-toggle:hover { color: #2563eb; border-color: #2563eb; }
  .bf-extra-chev { display: inline-block; transition: transform 0.2s ease; }
  .bf-extra-chev.open { transform: rotate(180deg); }
  .bf-extra-note { margin: 0.6rem 0; text-align: center; font-size: 0.75rem; color: var(--text-muted); }

  /* recently improved charts: a ring around the card and a banner under the level badge */
  .bf-new { background: linear-gradient(135deg, #ff4d8d, #ff8a3d); color: #fff;
    text-shadow: 0 1px 1px rgba(0,0,0,0.35); box-shadow: 0 0 6px rgba(255,90,120,0.6);
    font-variant-numeric: tabular-nums; }
  .bf-card-new { box-shadow: 0 0 0 2px #ff5a87, 0 0 10px rgba(255,90,135,0.45); }
  .bf-card-new:hover { box-shadow: 0 0 0 2px #ff5a87, 0 4px 14px rgba(255,90,135,0.55); }
  .bf-new-banner { padding: 2px 4px 2px 6px; border-radius: 8px 0 0 8px; font-size: 0.62rem; font-weight: 800;
    letter-spacing: 0.04em; line-height: 1.3; white-space: nowrap; }
  .bf-dlg-new { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; margin: 0.5rem 0 0.2rem;
    font-size: 0.8rem; color: #cfcfcf; font-variant-numeric: tabular-nums; }
  .bf-dlg-new-date { color: #7a7a7e; margin-left: auto; }

  /* tied charts: dimmed so they read as "not counted", brighter on hover so they're still easy to look at */
  .bf-card-muted { opacity: 0.45; transition: opacity 0.15s ease; }
  /* the popup for a chart they haven't played, in place of the score */
  .bf-dlg-unplayed { margin: 0.25rem 0 0.5rem; font-size: 1.1rem; font-weight: 700; color: var(--text-sub); }
  .bf-card-muted:hover, .bf-card-muted:focus-visible { opacity: 0.85; }

  /* ============ SEARCH (above B15) ============ */
  .bf-search { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 1rem 0 0.25rem; }
  .bf-search input { flex: 1; min-width: 200px; font: inherit; font-size: 0.9rem; padding: 8px 12px;
    border-radius: 8px; border: 1px solid var(--border-light); background: transparent; color: inherit; }
  .bf-search input:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .bf-search-count { font-size: 0.78rem; color: var(--text-sub); white-space: nowrap; }

  /* ============ POPUP: more details ============ */
  .bf-dialog { width: min(560px, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); overflow-y: auto; }
  .bf-dlg-subline { margin: 0.25rem 0 0; font-size: 0.8rem; color: #9a9a9e; overflow-wrap: anywhere; }
  .bf-section-label { margin: 0 0 0.5rem; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.05em;
    text-transform: uppercase; color: #7a7a7e; }
  .bf-stars { color: #f5c531; letter-spacing: 1px; margin-left: 6px; }
  .bf-prev { margin: 0 0 0.2rem; font-size: 0.8rem; color: #9a9a9e; font-variant-numeric: tabular-nums; }

  /* rating at each rank, for this chart's constant */
  .bf-ranktable { width: 100%; border-collapse: collapse; font-size: 0.82rem; font-variant-numeric: tabular-nums; }
  .bf-ranktable th { text-align: left; font-size: 0.68rem; font-weight: 700; color: #7a7a7e; padding: 0 6px 4px; }
  .bf-ranktable td { padding: 4px 6px; border-top: 1px solid #1c1c1f; color: #cfcfcf; }
  .bf-ranktable td:last-child, .bf-ranktable th:last-child { text-align: right; }
  .bf-ranktable img { height: 20px; width: auto; display: block; }
  .bf-ranktable tr.is-reached td { color: #fff; }
  .bf-ranktable tr.is-current td { background: rgba(37,99,235,0.18); }
  .bf-ranktable tr.is-current td:first-child { border-radius: 6px 0 0 6px; }
  .bf-ranktable tr.is-current td:last-child { border-radius: 0 6px 6px 0; }
  .bf-ranktable .bf-rt-gain { color: #82ff9f; font-weight: 700; }
  .bf-ranktable .bf-rt-note { color: #7a7a7e; font-style: italic; }

  .bf-links { display: flex; flex-wrap: wrap; gap: 8px; }
  .bf-link { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 9px;
    background: #19191c; border: 1px solid #2a2a2e; color: #fff; text-decoration: none; font-size: 0.82rem; font-weight: 700; }
  .bf-link:hover { background: #212124; border-color: #3a3a40; }
  .bf-link small { display: block; font-size: 0.66rem; font-weight: 600; color: #9a9a9e; }
  .bf-link svg { color: #e5484d; flex-shrink: 0; }
  .bf-link svg[stroke] { color: #5aa2ff; }
`;
