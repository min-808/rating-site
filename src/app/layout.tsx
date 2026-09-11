import './globals.css';
import Link from 'next/link';
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from '../components/ThemeProvider';
import ThemeToggle from '../components/ThemeToggle';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
        <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '0.5rem', fontFamily: 'sans-serif', position: 'relative' }}>
            
            {/* Toggle positioned to the top right of the 800px container */}
            <div style={{ position: 'absolute', right: '1rem', top: '0.5rem' }}>
              <ThemeToggle />
            </div>

            <header style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '1rem', 
              marginBottom: '0.5rem'
            }}>
              <Link 
                href="/" 
                style={{ 
                  padding: '0.4rem 1rem', 
                  backgroundColor: 'var(--btn-bg)', 
                  border: '1px solid var(--btn-border)', 
                  borderRadius: '6px', 
                  textDecoration: 'none', 
                  color: 'var(--btn-text)', 
                  fontWeight: 'bold' 
                }}
              >
                leaderboard
              </Link>
              <Link 
                href="/faq" 
                style={{ 
                  padding: '0.4rem 1rem', 
                  backgroundColor: 'var(--btn-bg)', 
                  border: '1px solid var(--btn-border)', 
                  borderRadius: '6px', 
                  textDecoration: 'none', 
                  color: 'var(--btn-text)', 
                  fontWeight: 'bold' 
                }}
              >
                faq
              </Link>
            </header>
          </div>
          
          {children}
          <Analytics />

          <footer style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
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
        </ThemeProvider>
      </body>
    </html>
  );
}