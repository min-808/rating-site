/**
 * Styles for a song's page (/songs/[id]) (components/SongPageView.tsx).
 * Layout: a banner with the cover and the chart picker, then the ranking on the left and
 * the details on the right. The page keeps its own dark palette (the --song-* colors)
 * whichever theme the site is in. (The layout was inspired by osu!'s beatmap page.)
 *
 * Every class here starts with "song-". Names say what the element is:
 *   song-banner-*        the top banner (blurred cover, tags, title, artist)
 *   song-chart-type-*    the ST / DX toggle
 *   song-difficulty-*    the BAS / ADV / EXP / MAS / Re:M tabs
 *   song-selected-chart* the label beside them naming the open chart
 *   song-ranking-*       the leaderboard table on the left
 *   song-top-score-*     the big #1 card above the table
 *   song-details-*       the boxes in the right column
 *   song-stat-bar-*      the progress bars in the "chart" box
 *   song-lookup-*        the YouTube / chart viewer links
 *
 * CSS variables set from the component:
 *   --difficulty-color  the color of a difficulty (basic green, master purple...)
 *   --bar-color         the fill color of one stat bar
 */
export const songDetailCss = `
  .song-page { max-width: 1100px; margin: 0 auto; padding: 0 1rem 2rem; font-family: sans-serif; color: var(--text-main); }
  .song-back-link { margin: 0.5rem 0; font-size: 0.85rem; }

  /* the dark box holding the banner and everything below it. its colors: */
  .song-card {
    --song-bg: #2b2328;            /* background of the body under the banner */
    --song-panel-bg: #382e33;      /* the boxes in the right column, the "show more" button */
    --song-row-bg: #3f343a;        /* a ranking row */
    --song-row-bg-alt: #372d32;    /* every other ranking row */
    --song-row-hover-bg: #4d4048;  /* a row or button under the mouse */
    --song-text: #fff;
    --song-text-dim: #b9aab1;      /* labels and secondary text */
    --song-accent-pink: #ff66ab;   /* ratings, the heading underline */
    --song-divider: rgba(255,255,255,0.08);
    color: var(--song-text); }
  .song-card img { max-width: none; }

  /* ============ banner ============ */
  .song-banner { position: relative; overflow: hidden; border-radius: 14px 14px 0 0; background: #1d1719; min-height: 250px;
    display: flex; flex-direction: column; justify-content: space-between; }
  .song-banner-blurred-cover { position: absolute; inset: -12px; background-size: cover; background-position: center 35%; filter: blur(6px) saturate(1.1); }
  .song-banner-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(20,14,17,0.92) 0%, rgba(20,14,17,0.62) 55%, rgba(20,14,17,0.35) 100%),
    linear-gradient(0deg, rgba(20,14,17,0.85) 0%, transparent 55%); }
  .song-banner-tags, .song-banner-title-row, .song-chart-select-row { position: relative; padding: 0 22px; }
  /* the chart picker along the bottom of the banner, all on one row (wraps on narrow screens),
     with space above it and below it so it doesn't sit squashed against the banner's edge */
  .song-chart-select-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; margin-top: 16px; padding-bottom: 20px; }
  .song-banner-tags { padding-top: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .song-tag { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px;
    background: rgba(255,255,255,0.14); }
  .song-tag.warn { background: rgba(255,170,60,0.4); }
  .song-banner-title-row { display: flex; gap: 18px; align-items: flex-end; margin-top: 18px; }
  .song-cover { width: 108px; height: 108px; flex-shrink: 0; border-radius: 10px; overflow: hidden; background: #3a3036; box-shadow: 0 6px 20px rgba(0,0,0,0.55); }
  .song-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .song-title-block { min-width: 0; }
  .song-title-block h1 { margin: 0; font-size: 1.9rem; line-height: 1.15; font-weight: 700; overflow-wrap: anywhere; text-shadow: 0 2px 8px rgba(0,0,0,0.7); }
  .song-artist { margin: 4px 0 0; font-size: 1.05rem; font-weight: 600; color: #e9dde2; overflow-wrap: anywhere; text-shadow: 0 1px 6px rgba(0,0,0,0.7); }

  /* ST / DX toggle, then the open type's difficulty tabs (easiest to hardest) */
  .song-chart-type-toggle { display: inline-flex; padding: 3px; border-radius: 999px; background: rgba(255,255,255,0.16); }
  .song-chart-type-button { all: unset; box-sizing: border-box; cursor: pointer; height: 26px; min-width: 46px; padding: 0 14px; border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center; font-size: 0.74rem; font-weight: 800; letter-spacing: 0.05em; color: #fff; opacity: 0.8;
    transition: background 0.12s, color 0.12s, opacity 0.12s; }
  .song-chart-type-button:hover { opacity: 1; }
  .song-chart-type-button.is-on { background: #fff; color: #2b2328; opacity: 1; }
  .song-chart-type-button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  /* difficulty tabs: rounded rectangles that never change size, so the open one can't
     spill onto the label next to it. closed: dark with a ring in the difficulty's color.
     open: filled with the color, with a white ring */
  .song-difficulty-buttons { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .song-difficulty-button { all: unset; box-sizing: border-box; cursor: pointer; height: 30px; min-width: 50px; padding: 0 12px; border-radius: 8px;
    display: inline-flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 900; letter-spacing: 0.04em; color: #fff;
    background: rgba(0,0,0,0.4); box-shadow: inset 0 0 0 2px var(--difficulty-color); transition: background 0.12s, box-shadow 0.12s; }
  .song-difficulty-button:hover { background: color-mix(in srgb, var(--difficulty-color) 45%, rgba(0,0,0,0.4)); }
  .song-difficulty-button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .song-difficulty-button.is-open { background: var(--difficulty-color); box-shadow: inset 0 0 0 2px #fff, 0 2px 8px rgba(0,0,0,0.45); }
  .fh.song-favorite-heart { position: absolute; top: 14px; right: 16px; z-index: 3; } /* .fh.: beats the heart's own position: relative */
  .song-selected-chart { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .song-selected-chart b { font-size: 1.15rem; text-shadow: 0 1px 6px rgba(0,0,0,0.7); }
  .song-selected-chart-constant { display: inline-block; font-size: 0.85rem; font-weight: 800; padding: 2px 12px; border-radius: 999px; background: var(--difficulty-color); color: #fff; }
  .song-selected-chart small { color: #e0d3d9; font-size: 0.8rem; }

  /* ============ body ============ */
  .song-body { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 0; background: var(--song-bg); border-radius: 0 0 14px 14px; }
  .song-ranking-column { padding: 18px 20px 22px; min-width: 0; }
  .song-details-column { padding: 18px 20px 22px 4px; display: grid; gap: 16px; align-content: start; }
  .song-ranking-header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 0 0 14px; }
  .song-ranking-header h2 { margin: 0; font-size: 1.05rem; font-weight: 700; padding-bottom: 4px; border-bottom: 3px solid var(--song-accent-pink); }
  .song-ranking-player-count { font-size: 0.8rem; color: var(--song-text-dim); }

  /* top score */
  .song-top-score { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 14px 16px; margin-bottom: 14px; border-radius: 12px;
    background: linear-gradient(120deg, #5a3a4b 0%, var(--song-panel-bg) 60%); box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
  .song-top-score-grade { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 56px; }
  .song-top-score-grade img { height: 38px; width: auto; display: block; }
  .song-top-score-grade span { font-size: 0.8rem; font-weight: 800; color: var(--song-accent-pink); }
  .song-player-avatar { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; background: var(--song-row-bg); flex-shrink: 0; }
  .song-top-score-player { min-width: 0; flex: 1 1 140px; }
  .song-top-score-player small { display: block; font-size: 0.68rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--song-text-dim); }
  .song-player-link { font-weight: 700; color: inherit; text-decoration: none; overflow-wrap: anywhere; }
  .song-player-link:hover { text-decoration: underline; }
  .song-top-score-player .song-player-link { font-size: 1.15rem; }
  .song-top-score-stats { display: flex; flex-wrap: wrap; gap: 6px 22px; }
  .song-top-score-stat small { display: block; font-size: 0.64rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--song-text-dim); }
  .song-top-score-stat b { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
  .song-top-score-stat b.pink { color: var(--song-accent-pink); }

  /* the ranking */
  .song-ranking-scroll { overflow-x: auto; }
  .song-ranking-table { width: 100%; border-collapse: separate; border-spacing: 0 3px; font-size: 0.86rem; font-variant-numeric: tabular-nums; }
  .song-ranking-table th { text-align: left; font-size: 0.66rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--song-text-dim); padding: 0 10px 4px; white-space: nowrap; }
  .song-ranking-table td { padding: 7px 10px; background: var(--song-row-bg); white-space: nowrap; color: var(--song-text-dim); }
  .song-ranking-table tr:nth-child(even) td { background: var(--song-row-bg-alt); }
  .song-ranking-table tbody tr:hover td { background: var(--song-row-hover-bg); }
  .song-ranking-table td:first-child { border-radius: 8px 0 0 8px; }
  .song-ranking-table td:last-child { border-radius: 0 8px 8px 0; }
  .song-ranking-table .r { text-align: right; }
  .song-ranking-table tr.is-first td { background: linear-gradient(90deg, rgba(255,102,171,0.22), var(--song-row-bg) 70%); }
  .song-ranking-position { font-weight: 700; color: var(--song-text) !important; width: 3rem; }
  .song-ranking-grade img { height: 20px; width: auto; display: block; }
  .song-ranking-accuracy { color: var(--song-text) !important; font-weight: 700; }
  .song-ranking-table .song-player-link { display: inline-flex; align-items: center; gap: 8px; color: var(--song-text); }
  .song-ranking-table .song-player-avatar { width: 24px; height: 24px; border-radius: 6px; }
  .song-combo-sync-badges { display: inline-flex; gap: 4px; align-items: center; }
  .song-combo-sync-badges img { height: 20px; width: auto; display: block; }
  .song-ranking-rating { color: var(--song-accent-pink) !important; font-weight: 800; }
  .song-ranking-empty { text-align: center; color: var(--song-text-dim); font-style: italic; padding: 2rem 0 1rem; }
  .song-ranking-show-more { display: block; margin: 12px auto 0; font: inherit; font-size: 0.85rem; padding: 8px 24px; border-radius: 999px; border: none; cursor: pointer;
    background: var(--song-panel-bg); color: var(--song-text); }
  .song-ranking-show-more:hover { background: var(--song-row-hover-bg); }

  /* right column */
  .song-details-box { background: var(--song-panel-bg); border-radius: 12px; padding: 14px 16px; }
  .song-details-box h3 { margin: 0 0 10px; font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--song-text-dim); }
  .song-stat-bar { margin-bottom: 10px; }
  .song-stat-bar:last-child { margin-bottom: 0; }
  .song-stat-bar-label { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px; }
  .song-stat-bar-label span:first-child { color: var(--song-text-dim); }
  .song-stat-bar-label span:last-child { font-weight: 700; font-variant-numeric: tabular-nums; }
  .song-stat-bar-track { height: 6px; border-radius: 3px; background: rgba(0,0,0,0.35); overflow: hidden; }
  .song-stat-bar-fill { height: 100%; border-radius: 3px; background: var(--bar-color, var(--song-accent-pink)); }
  .song-details-list { margin: 0; display: grid; gap: 7px; }
  .song-details-list > div { display: flex; justify-content: space-between; gap: 12px; font-size: 0.82rem; }
  .song-details-list dt { color: var(--song-text-dim); flex-shrink: 0; }
  .song-details-list dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
  .song-lookup-links { display: grid; gap: 8px; }
  .song-lookup-link { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 9px; text-decoration: none; color: var(--song-text);
    background: var(--song-row-bg); font-size: 0.85rem; font-weight: 700; }
  .song-lookup-link:hover { background: var(--song-row-hover-bg); }
  .song-lookup-link small { display: block; font-size: 0.68rem; font-weight: 600; color: var(--song-text-dim); }
  .song-lookup-link svg { flex-shrink: 0; color: #ff6b6f; } .song-lookup-link svg[stroke] { color: #6fb0ff; }
  .song-details-note { margin: 12px 0 0; font-size: 0.72rem; color: var(--song-text-dim); }

  @media (max-width: 820px) {
    .song-body { grid-template-columns: minmax(0, 1fr); }
    .song-details-column { padding: 0 20px 22px; }
    .song-banner-title-row { flex-direction: column; align-items: flex-start; gap: 12px; }
    .song-title-block h1 { font-size: 1.45rem; }
  }

  /* PILL TEXT, CENTERED. Where capitals and digits sit inside a line of text depends on the
     font (0 to ~0.12em too high in the fonts measured, worse when a character falls back to
     another font: ＆ ™ kana ✓). text-box-trim cuts that built-in space off, so the text is
     centered in the pill whatever font draws it. The padding is restated in em to keep each
     pill the size it was. Browsers without text-box-trim keep the rules above unchanged. */
  @supports (text-box-trim: trim-both) {
    .song-tag { display: inline-block; padding: 0.52em 0.9em; text-box-trim: trim-both; text-box-edge: cap alphabetic; }
    .song-selected-chart-constant { padding: 0.4em 0.88em; text-box-trim: trim-both; text-box-edge: cap alphabetic; }
    .song-pill-text { display: block; text-box-trim: trim-both; text-box-edge: cap alphabetic; } /* the text inside the difficulty tabs and ST/DX buttons */
  }
`;
