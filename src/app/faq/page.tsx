import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ - HI Maimai',
  description: 'frequently asked questions about the rating leaderboard.',
};

export default function Faq() {
  const codeStyle = {
    backgroundColor: "#f4f4f5",
    padding: "0.2rem 0.4rem",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "0.9em",
    border: "1px solid #e4e4e7"
  };

  const faqs = [
    {
      question: "why?",
      answer: (
        <>
            <p className="mb-4">
                i thought it would be pretty neat to have a rating leaderboard just for local hawaii maimai players. the goal is to foster friendly competition by finding new rivals around similar rating ranges and to encourage players to improve their skills. it's fun to see the rating number go up and have it reflect on the leaderboards imo
            </p>
            <p>
                since this site is unofficial, don't take the rankings as 100% accurate, but it's at least a decent approximation of where you stand in the local scene. it's also important to consider that rating is not the only metric of skill, so having more rating than one player doesn't necessarily mean you're better than them
            </p>
        </>
      ),
    },
    {
      question: "how?",
      answer: (
        <>
            <p>
                the backend first grabs users from the maimaidx-eng site by scraping each page of my friends list. it then stores rating and user information into a db, which is then fetched by this website every day at midnight. past ratings are also tracked in the db so you can see the rating difference for each player every 24hrs
            </p>
        </>
      ),
    },
    {
      question: "i'm a maimai player from hawaii. how do i get listed on the leaderboard?",
      answer: (
        <>
            <p>
                add me as a friend on maimai either by playing with me irl, or by going to the <a href="https://maimaidx-eng.com/maimai-mobile/friend/search/" target="_blank" rel="noopener noreferrer">friend site</a> and adding me with my friend code: <code style={codeStyle}>101142379434455</code>. optionally, you can let me know that you sent me a friend request by messaging me on discord <code style={codeStyle}>@waitaamin</code>. once you've been added to my friends list, you'll then be automatically put into the site on the next refresh
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
        faq
      </h1>

      <div style={{ marginTop: '2rem' }}>
        {faqs.map((faq, index) => (
          <div key={index} style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                {faq.question}
            </h2>
            <div style={{ margin: 0, lineHeight: '1.5', color: '#333' }}>
                {faq.answer}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
