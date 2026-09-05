import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'hi',
  description: 'hi',
};

export default function Awesome() {

  return (
    <main style={{ padding: '0 2rem 2rem 2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <p style={{ margin: 0, lineHeight: '1.5', color: '#ffbad5', fontSize: "5rem", fontWeight: "bold" }}>
        I LOVE MY GIRLFRIEND!!!!!
      </p>
    </main>
  );
}
