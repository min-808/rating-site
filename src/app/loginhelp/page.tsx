import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Login Help - HI Maimai',
  description: 'assistance with logging in',
};

export default function LoginHelp() {
  const codeStyle = {
    backgroundColor: "#f4f4f5",
    padding: "0.2rem 0.4rem",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "0.9em",
    border: "1px solid #e4e4e7"
  };

  const login_help_steps = [
    {
      question: "step 1",
      answer: (
        <>
            <p className="mb-4">
                locate and click on your username on the <Link href="/" target="_blank" rel="noopener noreferrer">leaderboards</Link>. you'll be directed to your public profile.
            </p>
        </>
      ),
    },
    {
      question: "step 2",
      answer: (
        <>
            <p>
                click on the <b>"Claim this profile"</b> button to get started with the verification process. 
            </p>
        </>
      ),
    },
    {
      question: "i'm a maimai player from hawaii. how do i get listed on the leaderboard?",
      highlight: true,
      answer: (
        <>
            <p>
                add me as a friend on maimai either by playing with me irl, or by going to the <a href="https://maimaidx-eng.com/maimai-mobile/friend/search/" target="_blank" rel="noopener noreferrer">friend site</a> and adding me with my friend code: <b>101142379434455</b>. i get notified whenever i get sent a friend request, so i'll accept it as soon as i can. once you've been added to my friends list, you'll then be automatically put into the site on the next refresh
            </p>
        </>
      ),
    },
    {
      question: "i don't want to be listed here",
      answer: (
        <>
            <p>
                please contact me via discord if you don't want to be shown on the website. i'll remove your listing
            </p>
            <p>
                additionally, if you want to stay on the leaderboards but you don't want your b50 to be shown, please let me know and i'll hide it from your profile
            </p>
        </>
      ),
    },
    {
      question: "how many players can be on the leaderboard?",
      answer: (
        <>
            <p>
                realistically, there can only be ≤100 players on the leaderboard due to the limitations of the maimai friend system. however, if i reach this limit and more players would like to be on the leaderboard, i can create another maimai account to accept any future friend requests
            </p>
        </>
      ),
    },
    {
      question: "why doesn't the leaderboard update at exactly midnight?",
      answer: (
        <>
            <p>
                unfortunately, vercel is not very good about executing cron jobs on time for the hobby tier. however, it's at least guaranteed that the leaderboard will update sometime between 12:00am and 12:59am
            </p>
        </>
      ),
    },
    {
      question: "something is broken or i have a cool new idea",
      answer: (
        <>
            <p>
                reach out to me on discord plz
            </p>
        </>
      ),
    },
    {
      question: "easiest 14?",
      answer: (
        <>
            <p>
                probably infinite enerzy overdoze
            </p>
        </>
      ),
    },
  ];

  return (
    <main style={{ padding: '0 2rem 2rem 2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        create an account
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
    </main>
  );
}
