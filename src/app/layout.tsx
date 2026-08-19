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
        {/* We wrap the header in a container to match your page widths */}
        <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '0.5rem', fontFamily: 'sans-serif' }}>
          <header style={{ 
            display: 'flex', 
            justifyContent: 'center', // This centers the buttons
            gap: '1rem', 
            marginBottom: '0.5rem'    // Reduced from 2rem to save space
          }}>
            <Link 
              href="/" 
              style={{ padding: '0.4rem 1rem', backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: '6px', textDecoration: 'none', color: '#333', fontWeight: 'bold' }}
            >
              home
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
      </body>
    </html>
  );
}