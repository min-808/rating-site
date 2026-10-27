import { toNormalWidth } from './leaderboard';

/**
 * Leaderboard player search. A player is found by their current name or any past name
 * (old_names), case and full-width letters don't matter, and several words each have to be
 * in there somewhere ("neko chan" finds "Neko-chan" and "chan neko").
 * Plain module: the server builds each row's search text, the browser matches the query.
 */

const fold = (text: string) => toNormalWidth(String(text ?? '')).normalize('NFKC').toLowerCase();

/** One row's search text: its name and past names, folded. Built on the server. */
export function playerSearchText(name: string, pastNames: string[] = []): string {
    return [name, ...pastNames].map(fold).join('\n');
}

/** The query, folded and split into words. An empty list means "show everyone". */
export function searchWords(query: string): string[] {
    return fold(query).split(/\s+/).filter(Boolean);
}

export function matchesPlayer(searchText: string, words: string[]): boolean {
    return words.every((w) => searchText.includes(w));
}