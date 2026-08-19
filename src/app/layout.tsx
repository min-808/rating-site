import './globals.css';
import Link from 'next/link';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
        {/* Navigation Header */}
      <header style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <Link 
          href="/" 
          style={{ padding: '0.5rem 1rem', backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: '6px', textDecoration: 'none', color: '#333', fontWeight: 'bold' }}
        >
          home
        </Link>
        <Link 
          href="/faq" 
          style={{ padding: '0.5rem 1rem', backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: '6px', textDecoration: 'none', color: '#333', fontWeight: 'bold' }}
        >
          faq
        </Link>
      </header>
      <body>{children}</body>
    </html>
  );
}