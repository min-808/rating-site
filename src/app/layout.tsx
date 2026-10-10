import './globals.css';
import Link from 'next/link';
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from '../components/ThemeProvider';
import ThemeToggle from '../components/ThemeToggle';
import AccountButton from '../components/AccountButton';
import { GoogleAnalytics } from '@next/third-parties/google';

/*
 * The bar at the top: leaderboard and faq centered, the account button and theme toggle
 * pinned to the right. On narrow screens there isn't room for both, so the right-hand
 * pair would cover the faq button: there, everything goes in one centered row instead
 * (leaderboard, faq, account, then the toggle), each button as wide as its text. (The account button's look is in AccountButton.tsx.)
 */
const siteTopCss = `
  .site-top { max-width: 800px; margin: 0 auto; padding-top: 0.5rem; font-family: sans-serif; position: relative; }
  .site-tools { position: absolute; right: 1rem; top: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
  .site-nav { display: flex; justify-content: center; gap: 1rem; margin-bottom: 0.5rem; }
  .site-link { padding: 0.4rem 1rem; background-color: var(--btn-bg); border: 1px solid var(--btn-border);
    border-radius: 6px; text-decoration: none; color: var(--btn-text); font-weight: bold; }

  @media (max-width: 700px) {
    .site-top { display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      padding: 0.5rem 1rem 0; margin-bottom: 0.5rem; }
    /* the nav and the tools stop being boxes of their own: their buttons all share one
       row, each as wide as its text */
    .site-nav, .site-tools { display: contents; }
    .site-link { order: 1; }
    .site-tools .acct-btn, .site-tools .acct-wrap { order: 2; }
    .site-tools > button { order: 3; flex-shrink: 0; }
    .site-link, .site-tools .acct-btn { padding: 0.4rem 0.75rem; font-size: 0.9rem; white-space: nowrap; }
  }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
        <style>{siteTopCss}</style>
        <div className="site-top">
            {/* top right: account button, then the theme toggle */}
            <div className="site-tools">
              <AccountButton />
              <ThemeToggle />
            </div>

            <header className="site-nav">
              <Link href="/" className="site-link">leaderboard</Link>
              <Link href="/faq" className="site-link">faq</Link>
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
      {process.env.GA_ID && <GoogleAnalytics gaId={process.env.GA_ID} />}
    </html>
  );
}