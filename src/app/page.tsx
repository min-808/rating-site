import { connectMongo, getMongoClient } from '../lib/connect-db';

// Keep the page static until explicitly revalidated by the cron job
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

  // Read from the processed daily snapshot collection
  const rawPlayers = await db
    .collection('daily_leaderboard')
    .find({})
    .sort({ currentRank: 1 })
    .toArray();

  const players = rawPlayers as unknown as PlayerDocument[];

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Hawaii Maimai Leaderboard</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: '8px' }}>Rank</th>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Rating</th>
            <th style={{ padding: '8px' }}>Rank Change</th>
            <th style={{ padding: '8px' }}>Rating Change</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const rankChange = calculateRankChange(player);
            const ratingChange = calculateRatingChange(player);

            return (
              <tr key={player._id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>#{player.currentRank}</td>
                <td style={{ padding: '8px', fontWeight: 'bold' }}>{player.name}</td>
                <td style={{ padding: '8px' }}>{player.rating.toLocaleString()}</td>
                <td style={{ padding: '8px' }}>
                  {rankChange > 0 ? (
                    <span style={{ color: 'green' }}>▲ +{rankChange}</span>
                  ) : rankChange < 0 ? (
                    <span style={{ color: 'red' }}>▼ {rankChange}</span>
                  ) : (
                    <span style={{ color: '#888' }}>-</span>
                  )}
                </td>
                <td style={{ padding: '8px' }}>
                  {ratingChange > 0 ? (
                    <span style={{ color: 'green' }}>+{ratingChange}</span>
                  ) : ratingChange < 0 ? (
                    <span style={{ color: 'red' }}>{ratingChange}</span>
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