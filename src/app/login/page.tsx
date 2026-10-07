import Link from 'next/link';
import type { Metadata } from 'next';
import LoginForm from '../../components/LoginForm';
import SignOutButton from '../../components/SignOutButton';
import { getSession, getDb } from '../../lib/auth';

export const metadata: Metadata = {
  title: 'Sign in - HI Maimai',
};

// reads the session cookie, so it's rendered fresh for every visitor
export const dynamic = 'force-dynamic';

const css = `
  .lg-wrap { max-width: 380px; margin: 0 auto; padding: 2rem 1rem 3rem; font-family: sans-serif; }
  .lg-back { display: inline-block; font-size: 0.85rem; color: var(--text-sub); text-decoration: none; margin-bottom: 1rem; }
  .lg-back:hover { color: #2563eb; }
  .lg-card { padding: 1.4rem 1.5rem; border-radius: 12px; border: 1px solid var(--border-light); }
  .lg-card h1 { margin: 0 0 1rem; font-size: 1.5rem; }
  .lg-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 0.8rem; }
  .lg-field label { font-size: 0.8rem; font-weight: 700; color: var(--text-sub); }
  .lg-field input { font: inherit; padding: 8px 10px; border-radius: 7px; border: 1px solid var(--border-light);
    background: transparent; color: inherit; }
  .lg-field input:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: transparent; }
  .lg-btn { width: 100%; margin-top: 0.25rem; border: 0; border-radius: 8px; padding: 9px 16px; font: inherit;
    font-weight: 700; cursor: pointer; background: #2563eb; color: #fff; }
  .lg-btn:hover:not(:disabled) { background: #1d4ed8; }
  .lg-btn:disabled { opacity: 0.6; cursor: default; }
  .lg-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .lg-btn-quiet { background: transparent; color: var(--text-sub); border: 1px solid var(--border-light); }
  .lg-btn-quiet:hover:not(:disabled) { background: rgba(127,127,127,0.12); }
  .lg-error { margin: 0 0 0.75rem; padding: 6px 10px; border-radius: 7px; font-size: 0.82rem;
    background: rgba(225, 29, 72, 0.12); color: #e11d48; }
  .lg-help { margin: 1rem 0 0; font-size: 0.8rem; line-height: 1.5; color: var(--text-sub); }
  .lg-help + .lg-help { margin-top: 0.5rem; }
  .lg-help a { color: #2563eb; }
`;

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const session = await getSession();

  // came from a claimed profile's "sign in" link: offer a reset for that profile
  const { profile } = await searchParams;
  const profileId = /^\d{1,7}$/.test(profile ?? '') ? Number(profile) : null;
  const resetHref = profileId != null ? `/user/${profileId}?reset=1` : null;

  // already signed in: point them to their profile instead of showing the form
  let profileHref: string | null = null;
  if (session) {
    const db = await getDb();
    const player = await db.collection('players').findOne({ user_id: session.userId }, { projection: { web_id: 1 } });
    profileHref = player ? `/user/${player.web_id}` : null;
  }

  return (
    <main className="lg-wrap">
      <style>{css}</style>
      <Link href="/" className="lg-back">← back to leaderboard</Link>

      {session ? (
        <div className="lg-card">
          <h1>You&apos;re signed in</h1>
          <p className="lg-help" style={{ marginTop: 0 }}>Signed in as <b>{session.username}</b>.</p>
          {profileHref && (
            <p><Link href={profileHref} className="lg-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Go to your profile</Link></p>
          )}
          <SignOutButton className="lg-btn lg-btn-quiet" />
        </div>
      ) : (
        <LoginForm resetHref={resetHref} />
      )}
    </main>
  );
}