import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

// one step or question on the page. highlight: the blue callout style
type Entry = { question: string; answer: ReactNode; highlight?: boolean };

export const metadata: Metadata = {
  title: 'Login Help - HI Maimai',
  description: 'how to claim your profile and make an account',
};

export default function LoginHelp() {
  const login_help_steps: Entry[] = [
    {
      question: "step 1: find your profile",
      answer: (
        <>
            <p>
                find and click on your username on the <Link href="/" target="_blank" rel="noopener noreferrer">leaderboards</Link>. you'll then be directed to your public profile
            </p>
            <p>
                not on the leaderboard yet? see <Link href="/faq#get-listed">&quot;how do i get listed on the leaderboard?&quot;</Link> in the faq first
            </p>
        </>
      ),
    },
    {
      question: "step 2: start the claim",
      answer: (
        <>
            <p>
                under your name, you'll see a message that says <b>"unclaimed profile, is this you?"</b> click on the <b>"claim this profile"</b> button next to it. there will be some instructions on the pop-up that'll guide you through the verification process
            </p>
            <p>
                don't change anything on the maimai site just yet. hit the <b>"start"</b> button to continue
            </p>
        </>
      ),
    },
    {
      question: "step 3: change your title",
      highlight: true,
      answer: (
        <>
            <p>
                go to the <a href="https://maimaidx-eng.com/maimai-mobile/collection/trophy/" target="_blank" rel="noopener noreferrer">maimai title customization page</a> (sign in, then collection → title) and set your title to any different one. this proves the maimai account is yours, since only you can change it
            </p>
            <p>
                you have <b>5 minutes</b> from pressing start, and a countdown will show you how much time you have
            </p>
            {/* screenshots of maimai NET: collection, then title, then set. side by side even on
                phones, where they're small but the red boxes still show; tap one for full size */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                {[
                  { src: '/loginsteps/step1.jpg', caption: '1. click on collection', alt: 'the maimai site\'s home page, with the collection button highlighted' },
                  { src: '/loginsteps/step2.jpg', caption: '2. click on title', alt: 'the maimai site\'s collection page, with the title tab highlighted' },
                  { src: '/loginsteps/step3.jpg', caption: '3. click set on any other title', alt: 'the maimai site\'s title list, each title with a set button' },
                ].map((shot) => (
                  <figure key={shot.src} style={{ margin: 0, flex: '1 1 0', minWidth: 0, maxWidth: '260px' }}>
                    <a href={shot.src} target="_blank" rel="noopener noreferrer" title="open full size">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={shot.src} alt={shot.alt} width={1038} height={1650} loading="lazy"
                        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
                    </a>
                    <figcaption style={{ marginTop: '0.4rem', fontSize: '0.85rem', textAlign: 'center' }}>{shot.caption}</figcaption>
                  </figure>
                ))}
            </div>
        </>
      ),
    },
    {
      question: "step 4: press verify",
      answer: (
        <>
            <p>
                after changing your title, come back to the site and press <b>"verify"</b>. if it says your title hasn't changed yet, wait a few seconds and try pressing it again
            </p>
        </>
      ),
    },
    {
      question: "step 5: make your account",
      answer: (
        <>
            <p>
                pick a username (3 to 20 characters) and a password (at least 8 characters), then press <b>"save and sign in"</b>. once you're finished setting up your account, and don't forget to change your title back
            </p>
            <p>
                feel free to explore the customization options on your profile page, and sign out by clicking on your name on the top right, and hitting <b>"sign out"</b>
            </p>
        </>
      ),
    },
]

const login_faq: Entry[] = [
    {
      question: "what can i do with an account?",
      answer: (
        <>
            <p>
                on your profile, you can write a <b>bio</b>, pick up to 5 of your <b>favorite scores</b> to show off, change your score visibility, pick your list of favorite songs/charts (WIP), and more!
            </p>
        </>
      ),
    },
    {
      question: "do i need to give you my maimai or sega password?",
      answer: (
        <>
            <p>
                no. to verify your account, you won't have to give us your maimai/sega password. the site only checks your public title, and you change it yourself on the maimai website. the password you pick in step 5 is only for this site
            </p>
        </>
      ),
    },
    {
      question: "it says claims are paused",
      answer: (
        <>
            <p>
                claims are unavailable while the backend updates scores and fetches charts. this happens around 12am, 8am, 3pm, 4pm, and 11pm (HST), and usually only takes a few minutes, except at 11pm, which can take longer. the message shows an estimate for how long is left, and claims reopen the moment it's done
            </p>
        </>
      ),
    },
    {
      question: "it says someone else is claiming a profile",
      answer: (
        <>
            <p>
                only one claim can run at a time across the whole site. it frees up as soon as theirs finishes, or after 5 minutes at most
            </p>
        </>
      ),
    },
    {
      question: "i forgot my password",
      answer: (
        <>
            <p>
                go to <Link href="/login/reset">reset your password</Link> (or click <b>"forgot your password?"</b> on the <Link href="/login">sign in</Link> page), find your profile, and go through the same title check again. this time, you'll pick a new password, and you'll be signed out everywhere else
            </p>
        </>
      ),
    },
    {
      question: "something went wrong",
      answer: (
        <>
            <p>
                reach out to me on discord plz
            </p>
        </>
      ),
    },
  ];

  return (
    <main style={{ padding: '0 2rem 2rem 2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        how to create an account
      </h1>

      <div style={{ marginTop: '2rem' }}>
        {login_help_steps.map((step, index) => (
          <div
            key={index}
            style={{
              marginBottom: '2rem',
                ...(step.highlight ? {
                backgroundColor: 'var(--step-highlight-bg)',
                borderLeft: '4px solid #2563eb',
                padding: '1rem',
                borderRadius: '0 4px 4px 0',
                marginLeft: '-1.25rem',
                } : {})
            }}
          >
            <h2 style={{
                fontSize: '1.2rem',
                marginBottom: '0.5rem',
                color: step.highlight ? 'var(--step-highlight-text)' : 'inherit'
              }}>
                {step.question}
            </h2>
            <div style={{ margin: 0, lineHeight: '1.5', color: 'var(--step-sub)' }}>
                {step.answer}
            </div>
          </div>
        ))}
      </div>

      <h1 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        account FAQ
      </h1>

      <div style={{ marginTop: '2rem' }}>
        {login_faq.map((step, index) => (
          <div
            key={index}
            style={{
              marginBottom: '2rem',
                ...(step.highlight ? {
                backgroundColor: 'var(--step-highlight-bg)',
                borderLeft: '4px solid #2563eb',
                padding: '1rem',
                borderRadius: '0 4px 4px 0',
                marginLeft: '-1.25rem',
                } : {})
            }}
          >
            <h2 style={{
                fontSize: '1.2rem',
                marginBottom: '0.5rem',
                color: step.highlight ? 'var(--step-highlight-text)' : 'inherit'
              }}>
                {step.question}
            </h2>
            <div style={{ margin: 0, lineHeight: '1.5', color: 'var(--step-sub)' }}>
                {step.answer}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
