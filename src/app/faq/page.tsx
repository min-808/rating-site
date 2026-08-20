import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HI Maimai - FAQ',
  description: 'Frequently asked questions about the rating leaderboard.',
};

export default function faq() {
  // 2. Reusable style for your discord code blocks
  const codeStyle = {
    backgroundColor: "#f4f4f5",
    padding: "0.2rem 0.4rem",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "0.9em",
    border: "1px solid #e4e4e7"
  };

  // 3. Changed answers to JSX (<>...</>) to embed the components
  const faqs = [
    {
      question: "how does this website work?",
      answer: (
        <>
        <details>
            <summary>magic</summary>
            every day at 11:55pm HST, the backend grabs users from the maimaidx-eng site by scraping each page of my friends list. it then stores rating and user information into a db, which is then fetched by this website every day at midnight. past ratings are also tracked in the db so you can see the rating difference for each player every 24hrs
        </details>
        </>
      ),
    },
    {
      question: "i'm a maimai player from hawaii. how do i get listed on the leaderboard?",
      answer: (
        <>
          add me as a friend on maimai either by playing with me irl, or by going to the <a href="https://maimaidx-eng.com/maimai-mobile/friend/search/" target="_blank" rel="noopener noreferrer">friend site</a> and adding me with my friend code: <code style={codeStyle}>101142379434455</code>. optionally, you can let me know that you friend requested me by messaging me on discord <code style={codeStyle}>@waitaamin</code>. once you've been added to my friends list, you'll then be automatically put into the site on the next refresh
        </>
      ),
    },
    {
      question: "i don't want to be listed here!",
      answer: (
        <>
          please contact me via discord if you don't to be shown on the website. i'll remove your listing asap
        </>
      ),
    },
    {
      question: "how many players can be on the leaderboard?",
      answer: (
        <>
          realistically, there can only be ≤100 players on the leaderboard due to the limitations of the maimai friend system. if i reach this limit, i won't be able to add any new players
        </>
      ),
    },
    {
      question: "easiest 14?",
      answer: (
        <>
          probably infinite enerzy overdoze
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
