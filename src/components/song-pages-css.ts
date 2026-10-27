/**
 * Styles for the song pages: the searchable list (sg-, SongBrowser.tsx and /songs) and a
 * song's page (sd-, /songs/[id]). One string, drawn in a <style> tag by each page. Colors
 * come from the site's theme variables, so both themes work.
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
  .sg-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 10px; }
  .sg-link { display: flex; gap: 12px; padding: 10px; border: 1px solid var(--border-light); border-radius: 10px;
    text-decoration: none; color: inherit; background: var(--btn-bg); height: 100%; box-sizing: border-box; }
  .sg-link:hover { border-color: var(--border-strong); }
  .sg-jacket { width: 76px; height: 76px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: var(--border-light);
    display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 1.6rem; }
  .sg-jacket img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sg-info { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .sg-name { margin: 0; font-weight: 700; font-size: 0.95rem; line-height: 1.25; overflow-wrap: anywhere; }
  .sg-artist { margin: 0; font-size: 0.78rem; color: var(--text-muted); overflow-wrap: anywhere; }
  .sg-pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: auto; padding-top: 4px; }
  .sg-pill { font-size: 0.68rem; font-weight: 800; padding: 1px 7px; border-radius: 999px; color: #fff; white-space: nowrap; }
  .sg-more { display: block; margin: 1rem auto 0; font: inherit; padding: 8px 22px; border-radius: 8px; cursor: pointer;
    background: var(--btn-bg); color: var(--btn-text); border: 1px solid var(--btn-border); }
  .sg-empty { text-align: center; color: var(--text-muted); font-style: italic; padding: 2rem 0; }

  /* ============ SONG PAGE: banner ============ */
  .sd-crumb { margin: 0.5rem 0; font-size: 0.85rem; }
  .sd-hero { position: relative; overflow: hidden; border-radius: 14px; background: #20222a; color: #fff; }
  .sd-hero-bg { position: absolute; inset: -30px; background-size: cover; background-position: center; filter: blur(22px) brightness(0.45); }
  .sd-hero-inner { position: relative; display: flex; gap: 18px; padding: 18px; align-items: flex-end; }
  .sd-jacket { width: 150px; height: 150px; flex-shrink: 0; border-radius: 10px; overflow: hidden; background: #333; box-shadow: 0 4px 18px rgba(0,0,0,0.5); }
  .sd-jacket img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sd-titles { min-width: 0; }
  .sd-titles h1 { margin: 0; font-size: 1.6rem; line-height: 1.2; overflow-wrap: anywhere; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }
  .sd-artist { margin: 4px 0 10px; font-size: 1rem; opacity: 0.9; overflow-wrap: anywhere; }
  .sd-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .sd-chip { font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: rgba(255,255,255,0.16); }
  .sd-chip.warn { background: rgba(255,170,60,0.35); }

  /* ============ SONG PAGE: chart tabs ============ */
  .sd-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 1rem 0; }
  .sd-tab { display: inline-flex; flex-direction: column; padding: 6px 14px; border-radius: 10px; text-decoration: none; color: var(--text-main);
    border: 2px solid var(--border-light); background: var(--btn-bg); line-height: 1.25; }
  .sd-tab:hover { border-color: var(--border-strong); }
  .sd-tab.is-active { border-color: var(--tab-color); box-shadow: inset 0 0 0 1px var(--tab-color); }
  .sd-tab b { font-size: 0.85rem; }
  .sd-tab small { font-size: 0.7rem; color: var(--text-muted); }
  .sd-tab i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--tab-color); margin-right: 6px; }

  /* ============ SONG PAGE: leaderboard + side panel ============ */
  .sd-body { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; align-items: start; }
  .sd-card { border: 1px solid var(--border-light); border-radius: 12px; padding: 14px; background: var(--btn-bg); }
  .sd-card h2 { margin: 0 0 10px; font-size: 0.8rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); }
  .sd-scroll { overflow-x: auto; }
  .sd-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; font-variant-numeric: tabular-nums; }
  .sd-table th { text-align: left; font-size: 0.7rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); padding: 0 8px 8px; white-space: nowrap; }
  .sd-table td { padding: 7px 8px; border-top: 1px solid var(--border-light); white-space: nowrap; }
  .sd-table .num { text-align: right; }
  .sd-pos { font-weight: 800; color: var(--text-muted); width: 2.2rem; }
  .sd-pos.p1 { color: #e0a800; } .sd-pos.p2 { color: #9aa3ad; } .sd-pos.p3 { color: #c0743a; }
  .sd-player { display: inline-flex; align-items: center; gap: 8px; color: inherit; text-decoration: none; font-weight: 700; }
  .sd-player:hover { text-decoration: underline; }
  .sd-avatar { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; background: var(--border-light); flex-shrink: 0; }
  .sd-acc { display: inline-flex; align-items: center; gap: 6px; }
  .sd-acc img { height: 20px; width: auto; display: block; }
  .sd-badges { display: inline-flex; gap: 4px; align-items: center; }
  .sd-badges img { height: 20px; width: auto; display: block; }
  .sd-dim { color: var(--text-muted); }
  .sd-empty { text-align: center; color: var(--text-muted); font-style: italic; padding: 1.5rem 0 0.5rem; }
  .sd-stats { margin: 0; display: grid; gap: 8px; }
  .sd-stats > div { display: flex; justify-content: space-between; gap: 10px; font-size: 0.88rem; }
  .sd-stats dt { color: var(--text-muted); }
  .sd-stats dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
  .sd-side { display: grid; gap: 12px; }
  .sd-links { display: grid; gap: 8px; }
  .sd-link { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 9px; text-decoration: none; color: var(--text-main);
    border: 1px solid var(--border-strong); font-size: 0.85rem; font-weight: 700; }
  .sd-link:hover { background: var(--border-light); }
  .sd-link small { display: block; font-size: 0.68rem; font-weight: 600; color: var(--text-muted); }
  .sd-link svg { flex-shrink: 0; color: #e5484d; } .sd-link svg[stroke] { color: #2f6fe0; }
  .sd-note { margin: 10px 0 0; font-size: 0.75rem; color: var(--text-muted); }

  @media (max-width: 760px) {
    .sd-body { grid-template-columns: minmax(0, 1fr); }
    .sd-hero-inner { flex-direction: column; align-items: flex-start; }
    .sd-jacket { width: 110px; height: 110px; }
    .sd-titles h1 { font-size: 1.3rem; }
  }
`;
