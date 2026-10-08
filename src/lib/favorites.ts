/**
 * Favorite scores rules, shared by the API route (which enforces them) and the
 * profile section (which shows them). Plain module, no 'use client'.
 */
export const FAVORITES_MAX = 5;

// which chart a favorite points at: the same key the score cards use
export const favoriteKey = (s: { difficulty: string; kind: string; title: string }) =>
  `${s.difficulty}-${s.kind}-${s.title}`;
