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
      highlight: true,
      // linked from /loginhelp as /faq#get-listed
      id: "get-listed",
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
      question: "why don't my scores update every night?",
      answer: (
        <>
            <p>
                to cut down on requests to the maimai website, we pull your scores <b>only</b> if you gained rating that day. however, if you would like to refresh your scores manually, feel free to hit the "refresh scores" button on your profile page. note that this will not update the rating number in your rating frame, but it will update your scores, your b50, and level breakdown numbers
            </p>
        </>
      ),
    },
    {
      question: "for some profiles, the rating shown in the frame differs from the calculated rating",
      answer: (
        <>
            <p>
                the reasoning for this varies, but it mainly boils down to the fact that these players haven't logged in on the latest version. since the b15 calculation changes depending on what the current and previous versions are, if the player had played a prism plus chart while circle was still the latest version, it'll still remain in their b15. however, once they log into circle plus to update their account, it'll leave their b15. maimai net keeps this stale rating depending on the last version they played on, and doesn't update the calculation until the player cards in on circle plus
            </p>
            <p>
                additionally, chart constants get updated every version, which can alter rating calculations if the player hasn't logged into the most recent version
            </p>
            <p>
                or, as mentioned in an earlier faq, the player had done a mid-day refresh of their scores
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
          <div 
            key={index} 
            id={faq.id}
            style={{ 
              marginBottom: '2rem',
                ...(faq.highlight ? {
                backgroundColor: 'var(--faq-highlight-bg)',
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
                color: faq.highlight ? 'var(--faq-highlight-text)' : 'inherit'
              }}>
                {faq.question}
            </h2>
            <div style={{ margin: 0, lineHeight: '1.5', color: 'var(--faq-sub)' }}>
                {faq.answer}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
