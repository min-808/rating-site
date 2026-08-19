"use client";
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
          every day at 11:55pm, the backend grabs the users from the maimai site by scraping each page of my friends list. it then stores rating and user information into a database, which is then fetched by this website every day at midnight. past ratings are also tracked in the database so you can see the rating difference for each player every 24hrs
        </>
      ),
    },
    {
      question: "i'm a maimai player from hawaii. how do i get listed on this website?",
      answer: (
        <>
          add me as a friend on maimai either by playing with me irl, or by going to the <a href="https://maimaidx-eng.com/maimai-mobile/friend/search/">friend site</a> and adding me with my friend code: <code style={codeStyle}>101142379434455</code>. optionally, you can let me know that you friend requested me by messaging me on discord <code style={codeStyle}>@waitaamin</code>. once you've been added to my friends list, you'll then be scraped into the site on the next refresh
        </>
      ),
    },
    {
      question: "i don't want to be listed here!",
      answer: (
        <>
          please contact me via discord <code style={codeStyle}>@waitaamin</code> if you would not like to be shown on the website. i'll remove your listing asap
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
            <p style={{ margin: 0, lineHeight: '1.5', color: '#333' }}>
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
