import { connectMongo, getMongoClient } from '../lib/connect-db';

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

export default async function LeaderboardPage() {
  await connectMongo();
  const client = await getMongoClient();
  const db = client.db('maimai');

  const rawPlayers = await db
    .collection('daily_leaderboard')
    .find({})
    .sort({ currentRank: 1 })
    .toArray();

  const players = rawPlayers as unknown as PlayerDocument[];

  // Evaluated when revalidatePath('/') is triggered by the cron job
  const lastUpdated = new Date().toLocaleString('en-US', {
    timeZone: 'Pacific/Honolulu',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
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

      <h1 style={{ marginBottom: '0.25rem' }}>Hawaii Maimai Leaderboard</h1>
      <p style={{ fontSize: '0.8rem', color: '#777', marginTop: 0, marginBottom: '1.5rem' }}>
        Updated on {lastUpdated}
        <br />
        Updates daily at midnight
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: '8px' }}>Rank</th>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Rating</th>
            <th style={{ padding: '8px' }}>Rank Change (24hr)</th>
            <th style={{ padding: '8px' }}>Rating Change (24hr)</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => {
            const rankChange = calculateRankChange(player);
            const ratingChange = calculateRatingChange(player);
            
            const displayName = toNormalWidth(player.name);
            const rawPastNames = player.old_names || [];
            const pastNames = rawPastNames.map(toNormalWidth);

            return (
              <tr key={player._id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>#{index + 1}</td>

                {/* Hoverable Name Column */}
                <td style={{ padding: '8px', fontWeight: 'bold' }}>
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
                    displayName
                  )}
                </td>

                <td style={{ padding: '8px' }}>{player.rating.toLocaleString()}</td>

                {/* Rank Change Column */}
                <td style={{ padding: '8px' }}>
                  {rankChange > 0 ? (
                    <span style={{ color: 'green', fontWeight: '500' }}>▲ +{rankChange}</span>
                  ) : rankChange < 0 ? (
                    <span style={{ color: 'red', fontWeight: '500' }}>▼ {Math.abs(rankChange)}</span>
                  ) : (
                    <span style={{ color: '#888' }}>-</span>
                  )}
                </td>

                {/* Rating Change Column */}
                <td style={{ padding: '8px' }}>
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