/**
 * Bio rules, shared by the API route (which enforces them) and the editor
 * (which shows them). Plain module, no 'use client', so both sides can import it.
 */
export const BIO_MAX_CHARS = 300;
export const BIO_MAX_LINES = 8;

// tidies a bio the same way on both sides: unix newlines, no invisible control
// characters, no runs of blank lines, no spaces at the ends
export function cleanBio(raw: string) {
  return raw
    .replace(/\r\n?/g, '\n')
    // control characters other than newline and tab
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// counts emoji and other astral characters as 1, like a person would
export const bioLength = (bio: string) => [...bio].length;

// what's wrong with a cleaned bio, or null if it's fine
export function checkBio(bio: string): string | null {
  if (bioLength(bio) > BIO_MAX_CHARS) return `bios can be up to ${BIO_MAX_CHARS} characters`;
  if (bio.split('\n').length > BIO_MAX_LINES) return `bios can be up to ${BIO_MAX_LINES} lines`;
  return null;
}