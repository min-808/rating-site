// page.tsx

export default function faq() {
  // Placeholder data for your FAQs
  const faqs = [
    {
      question: "how does this website work?",
      answer: "a backend server grabs my friends list from the maimai site by scraping each page of my friends list. it then stores rating and user information into a database, which is then fetched by this website every day at midnight. past ratings are also tracked in the database so you can see the rating difference for each player every 24hrs.",
    },
    {
      question: "how do i get listed on this website?",
      answer: "first, add me as a friend on maimai either by playing with me irl, or with my friend code: xxx. then, you can optionally let me know that you added me by messaging me on discord @waitaamin. you'll then be scraped into the site on the next refresh.",
    },
    {
      question: "i don't want to be listed here!",
      answer: "please contact me via discord @waitaamin if you would not like to be shown on the website. i'll remove your listing asap!",
    },
  ];

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
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
