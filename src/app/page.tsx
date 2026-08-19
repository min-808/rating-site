import { connectMongo, getMongoClient } from '../lib/connect-db';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'HI Maimai - Rating Leaderboard',
  description: 'A website to track the rating and ranks of Hawaii Maimai players.',
};

export const revalidate = false;

interface HistoryEntry {
  rating: number;
  date: string;
}

interface RankHistoryEntry {
  rank: number;
  rating: number;
  date: string;
}

interface PlayerDocument {
  _id: string;
  name: string;
  rating: number;
  currentRank: number;
  previousRank: number;
  history?: HistoryEntry[];
  rank_history?: RankHistoryEntry[];
  old_names?: string[];
}

// You can define this outside your component or in a separate file
const ratingFrames = [
  { threshold: 16000, frame: '/frames/rainbow_kiwami.png' },
  { threshold: 15000, frame: '/frames/rainbow.png' },
  { threshold: 14500, frame: '/frames/platinum.png' },
  { threshold: 14000, frame: '/frames/gold.png' },
  { threshold: 13000, frame: '/frames/silver.png' },
  { threshold: 12000, frame: '/frames/bronze.png' },
  { threshold: 10000, frame: '/frames/purple.png' },
  { threshold: 7000, frame: '/frames/red.png' },
  { threshold: 4000, frame: '/frames/orange.png' },
  { threshold: 2000, frame: '/frames/green.png' },
  { threshold: 1000, frame: '/frames/blue.png' },
  { threshold: 0, frame: '/frames/white.png' },
];

function getFrameForRating(rating: number) {
  // Finds the first threshold the player's rating is greater than or equal to
  const match = ratingFrames.find(r => rating >= r.threshold);
  return match ? match.frame : '/frames/white.png'; // Fallback just in case
}

function toNormalWidth(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ');
}

function calculateRankChange(player: PlayerDocument): number {
  if (player.rank_history && player.rank_history.length > 1) {
    const latest = player.rank_history[player.rank_history.length - 1].rank;
    const previous = player.rank_history[player.rank_history.length - 2].rank;
    return previous - latest;
  }
  return player.previousRank - player.currentRank;
}

function calculateRatingChange(player: PlayerDocument): number {
  if (player.history && player.history.length > 1) {
    const latest = player.history[player.history.length - 1].rating;
    const previous = player.history[player.history.length - 2].rating;
    return latest - previous;
  }
  return 0;
}

function isNewPlayer(player: PlayerDocument, updateDate: Date): boolean {
  if (!player.rank_history || player.rank_history.length === 0) {
    return false;
  }
  
  // Get the date of their very first appearance on the leaderboard
  const firstEntryDate = new Date(player.rank_history[0].date);
  
  if (isNaN(firstEntryDate.getTime())) return false; // Fallback for invalid dates
  
  // Calculate the difference in hours
  const diffMs = updateDate.getTime() - firstEntryDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return diffHours <= 24;
}

export default async function LeaderboardPage() {
  await connectMongo();
  const client = await getMongoClient();
  const db = client.db('maimai');

  // Fetch the players
  const rawPlayers = await db
    .collection('daily_leaderboard')
    .find({})
    .sort({ currentRank: 1 })
    .toArray();

  const players = rawPlayers as unknown as PlayerDocument[];

  // NEW: Fetch the exact update time from the database
  const metadata = await db.collection('metadata').findOne({ _id: 'leaderboard_update' });
  
  // Fallback to current time only if the metadata document doesn't exist yet
  const updateDate = metadata?.lastUpdated ? new Date(metadata.lastUpdated) : new Date();

  const lastUpdated = updateDate.toLocaleString('en-US', {
    timeZone: 'Pacific/Honolulu',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  return (
    <main style={{ padding: '0 2rem 2rem 2rem', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <style>{`
        .tooltip-container {
          position: relative;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
        }
        .tooltip-box {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          bottom: 130%;
          left: 0;
          background-color: #222;
          color: #fff;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: normal;
          white-space: nowrap;
          z-index: 20;
          box-shadow: 0px 4px 12px rgba(0,0,0,0.25);
          transition: opacity 0.15s ease-in-out, visibility 0.15s ease-in-out;
          pointer-events: none;
        }
        .tooltip-box::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 15px;
          border-width: 5px;
          border-style: solid;
          border-color: #222 transparent transparent transparent;
        }
        .tooltip-container:hover .tooltip-box {
          visibility: visible;
          opacity: 1;
        }
      `}</style>

      <h1 style={{ marginBottom: '0.25rem' }}>HI Maimai Rating Leaderboard</h1>
      <p style={{ fontSize: '0.8rem', color: '#777', marginTop: 0, marginBottom: '1.5rem' }}>
        There are currently <b>{players.length}</b> players on the leaderboard
        <br />
        <br />
        Last updated on {lastUpdated}
        <br />
        Automatically updates every day at midnight
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: '10px 8px' }}>Rank</th>
            <th style={{ padding: '10px 8px' }}>Name</th>
            <th style={{ padding: '10px 8px', textAlign: 'center' }}>Rating</th>
            <th style={{ padding: '10px 8px', textAlign: 'center' }}>Rank Change (24hr)</th>
            <th style={{ padding: '10px 8px', textAlign: 'center' }}>Rating Change (24hr)</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => {
            const rankChange = calculateRankChange(player);
            const ratingChange = calculateRatingChange(player);
            
            const isNew = isNewPlayer(player, updateDate);
            
            const displayName = toNormalWidth(player.name);
            const rawPastNames = player.old_names || [];
            const pastNames = rawPastNames.map(toNormalWidth);

            return (
              <tr key={player._id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 8px' }}>#{index + 1}</td>

                {/* Hoverable Name Column */}
                <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {pastNames.length > 0 ? (
                      <div className="tooltip-container">
                        <span>{displayName}</span>
                        <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: '6px' }}>📜</span>
                        
                        <div className="tooltip-box">
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px solid #444', paddingBottom: '2px', color: '#aaa' }}>
                            Past Names
                          </div>
                          {pastNames.map((name, idx) => (
                            <div key={idx} style={{ padding: '2px 0' }}>• {name}</div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span>{displayName}</span>
                    )}

                    {isNew && (
                      <span style={{
                        marginLeft: '8px',
                        backgroundColor: '#ff4757',
                        color: 'white',
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        letterSpacing: '0.5px'
                      }}>
                        NEW!
                      </span>
                    )}
                  </div>
                </td>

                {/* Rating Badge (Centered) */}
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  <div 
                    style={{
                      backgroundImage: `url(${getFrameForRating(player.rating)})`,
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      width: '98px',
                      height: '28px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      color: '#fff',
                      fontWeight: 'bold',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                      paddingRight: '16px'
                    }}
                  >
                    {player.rating}
                  </div>
                </td>

                {/* Rank Change Column (Centered) */}
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  {rankChange > 0 ? (
                    <span style={{ color: 'green', fontWeight: '500' }}>▲ +{rankChange}</span>
                  ) : rankChange < 0 ? (
                    <span style={{ color: 'red', fontWeight: '500' }}>▼ {Math.abs(rankChange)}</span>
                  ) : (
                    <span style={{ color: '#888' }}>-</span>
                  )}
                </td>

                {/* Rating Change Column (Centered) */}
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  {ratingChange > 0 ? (
                    <span style={{ color: 'green', fontWeight: '500' }}>+{ratingChange.toLocaleString()}</span>
                  ) : ratingChange < 0 ? (
                    <span style={{ color: 'red', fontWeight: '500' }}>{ratingChange.toLocaleString()}</span>
                  ) : (
                    <span style={{ color: '#888' }}>0</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}