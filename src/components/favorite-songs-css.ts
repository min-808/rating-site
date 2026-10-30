/** The "favorite songs" section on a profile (FavoriteSongs.tsx). Prefix: fs-. */
export const favoriteSongsCss = `
  .fs-card { margin: 1rem 0; padding: 0.75rem 1rem 1rem; border: 1px solid var(--border-light); border-radius: 12px; font-size: 0.9rem; }
  .fs-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 0 0 0.6rem; }
  .fs-head h2 { margin: 0; font-size: 0.95rem; }
  .fs-error { margin: 0 0 0.5rem; font-size: 0.8rem; color: #ef4444; }
  .fs-empty { margin: 0; color: var(--text-muted); font-style: italic; font-size: 0.85rem; }
  .fs-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
  .fs-grid + details { margin-top: 8px; }
  .fs-item { position: relative; display: flex; align-items: center; gap: 10px; padding: 7px; border: 1px solid var(--border-light); border-radius: 9px;
    text-decoration: none; color: inherit; background: var(--btn-bg); overflow: hidden; height: 100%; box-sizing: border-box; }
  .fs-item:hover { border-color: var(--border-strong); }
  .fs-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.16; pointer-events: none;
    -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0.3), #000 75%); mask-image: linear-gradient(90deg, rgba(0,0,0,0.3), #000 75%); }
  .fs-jacket { position: relative; width: 44px; height: 44px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: var(--border-light); }
  .fs-jacket img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .fs-text { position: relative; min-width: 0; }
  .fs-title { margin: 0; font-weight: 700; font-size: 0.85rem; line-height: 1.25; overflow-wrap: anywhere; }
  .fs-artist { margin: 0; font-size: 0.72rem; color: var(--text-muted); overflow-wrap: anywhere; }
  /* the owner's × on each card: shows on hover (always on touch screens, which can't hover) */
  .fs-li { position: relative; }
  .fs-remove { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 6px; border: 0;
    display: flex; align-items: center; justify-content: center; padding: 0; font-size: 1rem; line-height: 1; cursor: pointer;
    background: rgba(0, 0, 0, 0.45); color: #fff; opacity: 0; transition: opacity 0.12s; }
  .fs-li:hover .fs-remove, .fs-remove:focus-visible { opacity: 1; }
  .fs-remove:hover { background: #ef4444; }
  .fs-remove:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
  @media (hover: none) { .fs-remove { opacity: 1; } }
  .fs-more summary { cursor: pointer; font-size: 0.82rem; color: var(--text-sub); padding: 4px 0; }
  .fs-more .fs-grid { margin-top: 6px; }
`;
