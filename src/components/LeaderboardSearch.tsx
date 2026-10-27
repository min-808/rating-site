'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { matchesPlayer, searchWords } from '../lib/player-search';

/**
 * The leaderboard's search box. It wraps the table: the box sits above it, and each
 * LeaderboardRow asks this for the current words and hides itself if it doesn't match.
 * The table stays rendered on the server; only the filtering happens in the browser, and
 * every row keeps its real rank number.
 *
 * texts: every row's search text (lib/player-search.ts), in table order, so the
 * "x of y players" count and the "no matches" message can be worked out here.
 */

const WordsContext = createContext<string[]>([]);
export const useSearchWords = () => useContext(WordsContext);

const css = `
  .lbs-wrap { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 0 1rem; }
  .lbs-input { flex: 1; min-width: 220px; max-width: 420px; font: inherit; font-size: 0.9rem; padding: 8px 12px;
    border-radius: 8px; border: 1px solid var(--border-light); background: transparent; color: inherit; }
  .lbs-input:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .lbs-count { font-size: 0.78rem; color: var(--text-sub); white-space: nowrap; }
  .lbs-none { margin: 1rem 0; text-align: center; font-size: 0.9rem; font-style: italic; color: var(--text-muted); }
`;

export default function LeaderboardSearch({ texts, children }: { texts: string[]; children: ReactNode }) {
    const [query, setQuery] = useState('');
    const words = useMemo(() => searchWords(query), [query]);
    const count = useMemo(
        () => (words.length ? texts.filter((t) => matchesPlayer(t, words)).length : texts.length),
        [texts, words],
    );

    return (
        <WordsContext.Provider value={words}>
            <style>{css}</style>
            <div className="lbs-wrap">
                <input
                    className="lbs-input"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="search players (including past names)"
                    aria-label="search players"
                />
                {words.length > 0 && <span className="lbs-count">{count} of {texts.length} players</span>}
            </div>
            {children}
            {words.length > 0 && count === 0 && <p className="lbs-none">no players match &ldquo;{query.trim()}&rdquo;</p>}
        </WordsContext.Provider>
    );
}