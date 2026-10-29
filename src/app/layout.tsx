import './globals.css';
import Link from 'next/link';
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from '../components/ThemeProvider';
import ThemeToggle from '../components/ThemeToggle';
import AccountButton from '../components/AccountButton';
import { GoogleAnalytics } from '@next/third-parties/google';
import type { Metadata } from 'next';

// no page translation, site-wide: browser translators (Chrome's especially) swap the text
// for their own copies, which freezes text that changes without a reload (a song page's
// chart switch) and leaves the fonts broken after going back to the original. this stops
// Chrome offering it; translate="no" on <html> below tells every browser to leave it alone
export const metadata: Metadata = { other: { google: 'notranslate' } };

/*
 * The bar at the top: leaderboard, songs and faq centered, the account button and theme
 * toggle on the right. On narrow screens there isn't room for both side by side: there,
 * everything goes in one centered row instead (leaderboard, songs, faq, account, then the
 * toggle), each button as wide as its text. (The account button's look is in AccountButton.tsx.)
 */
const siteTopCss = `
  /* three columns: an empty one on the left, the nav links in the middle, the account
     button + theme toggle on the right. The two outer columns are the same width, so the
     links stay centered, and each column gets its own space, so the account button can
     never sit on top of a link and swallow its clicks. */
  .site-top { max-width: 800px; margin: 0 auto 0.5rem; padding: 0.5rem 1rem 0; box-sizing: border-box; font-family: sans-serif;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; column-gap: 1rem; }
  .site-nav { grid-column: 2; grid-row: 1; display: flex; justify-content: center; gap: 1rem; }
  .site-tools { grid-column: 3; grid-row: 1; justify-self: end; display: flex; align-items: center; gap: 0.5rem; }
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
    <html lang="en" translate="no" suppressHydrationWarning>
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
              <Link href="/charts" className="site-link">charts</Link>
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
            made by min &amp; sora
            <br />
            discord/twt: @waitaamin &amp; @soratsky
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