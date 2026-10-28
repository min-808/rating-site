/**
 * Styles for a song's page (/songs/[id]), after osu!'s beatmap page: a banner with the
 * cover, a row of round chart icons, then the ranking on the left with the details on the
 * right. It keeps its own dark palette (the --o-* colors) whichever theme the site is in,
 * like osu! does. Prefix: osu-.
 */
export const songDetailCss = `
  .osu-page { max-width: 1100px; margin: 0 auto; padding: 0 1rem 2rem; font-family: sans-serif; color: var(--text-main); }
  .osu-crumb { margin: 0.5rem 0; font-size: 0.85rem; }

  .osu { --o-bg: #2b2328; --o-panel: #382e33; --o-row: #3f343a; --o-row2: #372d32; --o-hover: #4d4048;
    --o-text: #fff; --o-dim: #b9aab1; --o-pink: #ff66ab; --o-line: rgba(255,255,255,0.08);
    color: var(--o-text); }
  .osu img { max-width: none; }

  /* ============ banner ============ */
  .osu-hero { position: relative; overflow: hidden; border-radius: 14px 14px 0 0; background: #1d1719; min-height: 250px;
    display: flex; flex-direction: column; justify-content: space-between; }
  .osu-hero-bg { position: absolute; inset: -12px; background-size: cover; background-position: center 35%; filter: blur(6px) saturate(1.1); }
  .osu-hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(20,14,17,0.92) 0%, rgba(20,14,17,0.62) 55%, rgba(20,14,17,0.35) 100%),
    linear-gradient(0deg, rgba(20,14,17,0.85) 0%, transparent 55%); }
  .osu-hero-top, .osu-hero-main, .osu-picker-row { position: relative; padding: 0 22px; }
  .osu-hero-top { padding-top: 16px; display: flex; flex-wrap: wrap; gap: 6px; }
  .osu-tag { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px;
    background: rgba(255,255,255,0.14); }
  .osu-tag.warn { background: rgba(255,170,60,0.4); }
  .osu-hero-main { display: flex; gap: 18px; align-items: flex-end; margin-top: 18px; }
  .osu-jacket { width: 108px; height: 108px; flex-shrink: 0; border-radius: 10px; overflow: hidden; background: #3a3036; box-shadow: 0 6px 20px rgba(0,0,0,0.55); }
  .osu-jacket img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .osu-titles { min-width: 0; }
  .osu-titles h1 { margin: 0; font-size: 1.9rem; line-height: 1.15; font-weight: 700; overflow-wrap: anywhere; text-shadow: 0 2px 8px rgba(0,0,0,0.7); }
  .osu-artist { margin: 4px 0 0; font-size: 1.05rem; font-weight: 600; color: #e9dde2; overflow-wrap: anywhere; text-shadow: 0 1px 6px rgba(0,0,0,0.7); }

  /* the round chart icons, easiest to hardest. the open one is bigger and ringed */
  .osu-picker-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 22px; padding-top: 18px; padding-bottom: 14px; }
  .osu-picker { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .osu-group-gap { width: 1px; align-self: stretch; background: rgba(255,255,255,0.25); margin: 4px 4px; }
  .osu-dot { all: unset; box-sizing: border-box; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; background: var(--dot);
    display: inline-flex; align-items: center; justify-content: center; font-size: 0.56rem; font-weight: 900; letter-spacing: 0.02em; color: #fff;
    box-shadow: inset 0 0 0 2px rgba(0,0,0,0.25); transition: transform 0.12s, box-shadow 0.12s; }
  .osu-dot:hover { transform: scale(1.12); }
  .osu-dot:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
  .osu-dot.is-open { transform: scale(1.3); box-shadow: 0 0 0 3px #fff, 0 2px 10px rgba(0,0,0,0.5); margin: 0 3px; }
  .osu-picked { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .osu-picked b { font-size: 1.15rem; text-shadow: 0 1px 6px rgba(0,0,0,0.7); }
  .osu-star { display: inline-block; font-size: 0.85rem; font-weight: 800; padding: 2px 12px; border-radius: 999px; background: var(--dot); color: #fff; }
  .osu-picked small { color: #e0d3d9; font-size: 0.8rem; }

  /* ============ body ============ */
  .osu-body { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 0; background: var(--o-bg); border-radius: 0 0 14px 14px; }
  .osu-left { padding: 18px 20px 22px; min-width: 0; }
  .osu-right { padding: 18px 20px 22px 4px; display: grid; gap: 16px; align-content: start; }
  .osu-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 0 0 14px; }
  .osu-head h2 { margin: 0; font-size: 1.05rem; font-weight: 700; padding-bottom: 4px; border-bottom: 3px solid var(--o-pink); }
  .osu-count { font-size: 0.8rem; color: var(--o-dim); }

  /* top score */
  .osu-top { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 14px 16px; margin-bottom: 14px; border-radius: 12px;
    background: linear-gradient(120deg, #5a3a4b 0%, var(--o-panel) 60%); box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
  .osu-top-rank { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 56px; }
  .osu-top-rank img { height: 38px; width: auto; display: block; }
  .osu-top-rank span { font-size: 0.8rem; font-weight: 800; color: var(--o-pink); }
  .osu-avatar { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; background: var(--o-row); flex-shrink: 0; }
  .osu-top-who { min-width: 0; flex: 1 1 140px; }
  .osu-top-who small { display: block; font-size: 0.68rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--o-dim); }
  .osu-player { font-weight: 700; color: inherit; text-decoration: none; overflow-wrap: anywhere; }
  .osu-player:hover { text-decoration: underline; }
  .osu-top-who .osu-player { font-size: 1.15rem; }
  .osu-top-stats { display: flex; flex-wrap: wrap; gap: 6px 22px; }
  .osu-stat small { display: block; font-size: 0.64rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--o-dim); }
  .osu-stat b { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
  .osu-stat b.pink { color: var(--o-pink); }

  /* the ranking */
  .osu-scroll { overflow-x: auto; }
  .osu-table { width: 100%; border-collapse: separate; border-spacing: 0 3px; font-size: 0.86rem; font-variant-numeric: tabular-nums; }
  .osu-table th { text-align: left; font-size: 0.66rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--o-dim); padding: 0 10px 4px; white-space: nowrap; }
  .osu-table td { padding: 7px 10px; background: var(--o-row); white-space: nowrap; color: var(--o-dim); }
  .osu-table tr:nth-child(even) td { background: var(--o-row2); }
  .osu-table tbody tr:hover td { background: var(--o-hover); }
  .osu-table td:first-child { border-radius: 8px 0 0 8px; }
  .osu-table td:last-child { border-radius: 0 8px 8px 0; }
  .osu-table .r { text-align: right; }
  .osu-table tr.is-first td { background: linear-gradient(90deg, rgba(255,102,171,0.22), var(--o-row) 70%); }
  .osu-pos { font-weight: 700; color: var(--o-text) !important; width: 3rem; }
  .osu-grade img { height: 20px; width: auto; display: block; }
  .osu-acc { color: var(--o-text) !important; font-weight: 700; }
  .osu-table .osu-player { display: inline-flex; align-items: center; gap: 8px; color: var(--o-text); }
  .osu-table .osu-avatar { width: 24px; height: 24px; border-radius: 6px; }
  .osu-badges { display: inline-flex; gap: 4px; align-items: center; }
  .osu-badges img { height: 20px; width: auto; display: block; }
  .osu-rating { color: var(--o-pink) !important; font-weight: 800; }
  .osu-empty { text-align: center; color: var(--o-dim); font-style: italic; padding: 2rem 0 1rem; }
  .osu-more { display: block; margin: 12px auto 0; font: inherit; font-size: 0.85rem; padding: 8px 24px; border-radius: 999px; border: none; cursor: pointer;
    background: var(--o-panel); color: var(--o-text); }
  .osu-more:hover { background: var(--o-hover); }

  /* right column */
  .osu-box { background: var(--o-panel); border-radius: 12px; padding: 14px 16px; }
  .osu-box h3 { margin: 0 0 10px; font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--o-dim); }
  .osu-bar { margin-bottom: 10px; }
  .osu-bar:last-child { margin-bottom: 0; }
  .osu-bar-top { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px; }
  .osu-bar-top span:first-child { color: var(--o-dim); }
  .osu-bar-top span:last-child { font-weight: 700; font-variant-numeric: tabular-nums; }
  .osu-track { height: 6px; border-radius: 3px; background: rgba(0,0,0,0.35); overflow: hidden; }
  .osu-fill { height: 100%; border-radius: 3px; background: var(--fill, var(--o-pink)); }
  .osu-info { margin: 0; display: grid; gap: 7px; }
  .osu-info > div { display: flex; justify-content: space-between; gap: 12px; font-size: 0.82rem; }
  .osu-info dt { color: var(--o-dim); flex-shrink: 0; }
  .osu-info dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
  .osu-links { display: grid; gap: 8px; }
  .osu-link { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 9px; text-decoration: none; color: var(--o-text);
    background: var(--o-row); font-size: 0.85rem; font-weight: 700; }
  .osu-link:hover { background: var(--o-hover); }
  .osu-link small { display: block; font-size: 0.68rem; font-weight: 600; color: var(--o-dim); }
  .osu-link svg { flex-shrink: 0; color: #ff6b6f; } .osu-link svg[stroke] { color: #6fb0ff; }
  .osu-note { margin: 12px 0 0; font-size: 0.72rem; color: var(--o-dim); }

  @media (max-width: 820px) {
    .osu-body { grid-template-columns: minmax(0, 1fr); }
    .osu-right { padding: 0 20px 22px; }
    .osu-hero-main { flex-direction: column; align-items: flex-start; gap: 12px; }
    .osu-titles h1 { font-size: 1.45rem; }
  }
`;
