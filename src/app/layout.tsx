import './globals.css';
import Link from 'next/link';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '0.5rem', fontFamily: 'sans-serif' }}>
          <header style={{ 
            display: 'flex', 
            justifyContent: 'center', // centers the buttons
            gap: '1rem', 
            marginBottom: '0.5rem'
          }}>
            <Link 
              href="/" 
              style={{ padding: '0.4rem 1rem', backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: '6px', textDecoration: 'none', color: '#333', fontWeight: 'bold' }}
            >
              leaderboard
            </Link>
            <Link 
              href="/faq" 
              style={{ padding: '0.4rem 1rem', backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: '6px', textDecoration: 'none', color: '#333', fontWeight: 'bold' }}
            >
              faq
            </Link>
          </header>
        </div>
        
        {children}

        <footer style={{
          textAlign: 'center',
          color: 'gray',
          padding: '2rem 0 1rem',
          fontSize: '0.875rem',
          fontFamily: 'sans-serif'
        }}>
          made by min
          <br />
          discord/twt: @waitaamin
          <br />
          <br />
          &lt;3
        </footer>
      </body>
    </html>
  );
}
