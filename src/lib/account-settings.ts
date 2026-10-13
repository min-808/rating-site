/**
 * Rules for the settings page (/settings) that both the page and its routes need.
 * A plain module, no 'use client', so server code gets the real values.
 */

// how often a username can be changed in settings
export const USERNAME_CHANGE_DAYS = 7;

/** When the next username change is allowed, or null if it's allowed now. */
export function nextUsernameChange(lastChange: Date | string | null | undefined, now = new Date()): Date | null {
  if (!lastChange) return null;
  const next = new Date(new Date(lastChange).getTime() + USERNAME_CHANGE_DAYS * 86_400_000);
  return next > now ? next : null;
}
