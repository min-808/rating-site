/**
 * Favorite songs (the hearts on /songs and on a song's page), shared by the API route that
 * enforces the limit and the places that show them. Plain module.
 *
 * Not the same as the five favorite *scores* on a profile (lib/favorites.ts): those are
 * charts a player has played, picked in order. These are songs, any song, hearted like on
 * osu!, with no score needed. Kept on the account as favorite_songs: each song's key
 * (lib/song-id.ts), newest last.
 */
export const FAVORITE_SONGS_MAX = 300;
