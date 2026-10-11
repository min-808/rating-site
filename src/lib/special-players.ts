/**
 * The player whose name is pink everywhere it shows (the leaderboard, her profile, which
 * also gets the heart): her user_id, from GF_USER_ID in the env, so it's set in one place.
 * Server only. Unset, nobody's name is pink.
 */
export function isGf(userId: unknown) {
  const id = process.env.GF_USER_ID?.trim();
  return Boolean(id) && String(userId ?? '') === id;
}
