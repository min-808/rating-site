/**
 * Who's signed in, from the browser (/api/auth/me). Callers asking at the same moment share
 * one request: the header's account button and a page that also wants to know (a song page
 * highlighting your own score) ask together on every page load, and this makes that one
 * request, not two. Each new ask after that one has finished asks the server again, so
 * signing in or out still shows.
 */

export type Me =
  | { signedIn: false }
  | {
      signedIn: true;
      username: string;
      webId: number | null;
      icon?: string | null;
      iconFallback?: string | null;
      isAdmin?: boolean;
    };

let inFlight: Promise<Me> | null = null;

export function fetchMe(): Promise<Me> {
  if (!inFlight) {
    inFlight = fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json() as Promise<Me>)
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}
