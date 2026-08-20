import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'hi',
  description: 'hi',
};

export default function hi() {

  return (
    <main style={{ padding: '0 2rem 2rem 2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <p style={{ margin: 0, lineHeight: '1.5', color: '#333' }}>
        hi there
        <br />
        r u crawling this site lol
        <br />
        #lmk
      </p>
    </main>
  );
}
