import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 - HI Maimai',
  description: 'you stumbled on a page that doesn\'t exist!',
};

export default function NotFound() {

  return (
    <main style={{ padding: '0 2rem 2rem 2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <p style={{ margin: 0, lineHeight: '1.5', color: '#333', marginBottom: '1rem' }}>
        404 not found
      </p>
      <p style={{ margin: 0, lineHeight: '1.5', color: '#333', marginBottom: '1rem' }}>
        you stumbled on a page that doesn't exist!
      </p>
      <p style={{ margin: 0, lineHeight: '1.5', color: '#333' }}>
        <Link href="/">go back to the leaderboard</Link>
      </p>
    </main>
  );
}
