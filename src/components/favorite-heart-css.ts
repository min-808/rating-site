/** The heart button (FavoriteHeart.tsx). Drawn once per page by whatever shows hearts. */
export const favoriteHeartCss = `
  .fh { all: unset; box-sizing: border-box; position: relative; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center; color: var(--text-muted); transition: color 0.12s, transform 0.12s, background 0.12s; }
  .fh:hover { color: #ff4d8d; background: rgba(255,77,141,0.14); }
  .fh:active { transform: scale(0.9); }
  .fh:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .fh svg { width: 20px; height: 20px; display: block; fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; }
  .fh.is-on { color: #ff4d8d; }
  .fh.is-on svg { fill: currentColor; }
  .fh-hero { width: 42px; height: 42px; color: #fff; background: rgba(0,0,0,0.35); }
  .fh-hero svg { width: 24px; height: 24px; }
  .fh-hero:hover { color: #ff7ab0; background: rgba(0,0,0,0.5); }
  .fh-hero.is-on { color: #ff4d8d; }
  .fh-tip { position: absolute; top: calc(100% + 6px); right: 0; z-index: 5; white-space: nowrap; font-size: 0.75rem; font-weight: 600; line-height: 1.3;
    padding: 6px 10px; border-radius: 8px; background: #26202a; color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.4); pointer-events: none; }
`;
