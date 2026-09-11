import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PlayerHistoryChart from '../../../components/PlayerHistoryChart';
import { connectMongo, getMongoClient } from '../../../lib/connect-db';
import {
  type PlayerDocument,
  getFrameForRating,
  calculateRankChange,
  calculateRatingChange,
  toNormalWidth,
} from '../../../lib/leaderboard';

interface UserPageProps {
  params: Promise<{ id: string }>;
}

const TZ = 'Pacific/Honolulu';

// cached so generateMetadata and the page share one db lookup per request
const getPlayer = cache(async (id: string) => {
  const webId = parseInt(id, 10);
  if (Number.isNaN(webId)) return null;

  await connectMongo();
  const client = await getMongoClient();
  const doc = await client.db('maimai').collection('players').findOne({ web_id: webId });
  return doc as unknown as PlayerDocument | null;
});

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayer(id);
  return {
    title: player ? `${toNormalWidth(player.name)} - HI Maimai` : 'Player not found - HI Maimai',
  };
}

function Delta({ value, arrows = false, zeroText = '-' }: { value: number; arrows?: boolean; zeroText?: string }) {
  if (!Number.isFinite(value) || value === 0) {
    return <span style={{ color: 'var(--text-sub)' }}>{zeroText}</span>;
  }
  const up = value > 0;
  return (
    <span style={{ color: up ? 'var(--rating-gain)' : 'var(--rating-loss)', fontWeight: 500 }}>
      {arrows ? (up ? '▲ ' : '▼ ') : ''}
      {up ? '+' : '-'}
      {Math.abs(value).toLocaleString()}
    </span>
  );
}

const css = `
  .user-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 2rem 3rem 2rem;
    font-family: sans-serif;
  }
  .back-link {
    display: inline-block;
    font-size: 0.85rem;
    color: var(--text-sub);
    text-decoration: none;
    margin-bottom: 1rem;
  }
  .back-link:hover {
    color: #2563eb;
  }
  .user-header {
    border-bottom: 1px solid #ccc;
    padding-bottom: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .user-name {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .user-aka {
    margin: 0.35rem 0 0 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 2rem;
  }
  .stat-card {
    border: 1px solid var(--border-light);
    border-radius: 8px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }
  .stat-label {
    font-size: 0.75rem;
    color: var(--text-sub);
  }
  .stat-value {
    font-size: 1.4rem;
    font-weight: bold;
    line-height: 28px;
  }
  .stat-sub {
    font-size: 0.8rem;
    color: var(--text-sub);
  }
  .rating-badge {
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    width: 98px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    color: #fff;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    padding-right: 16px;
    box-sizing: border-box;
    filter: var(--badge-filter) drop-shadow(0px 0px 5px rgba(255, 255, 255, 0.3));
  }
  .updated {
    margin-top: 1.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  @media (max-width: 600px) {
    .user-container {
      padding: 1.25rem 1rem 2rem 1rem;
    }
    .user-name {
      font-size: 1.5rem;
    }
    .stat-grid {
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    .stat-card {
      padding: 0.6rem;
    }
    .stat-value {
      font-size: 1.05rem;
      line-height: 20px;
    }
    .stat-sub {
      font-size: 0.7rem;
    }
    .rating-badge {
      width: 70px;
      height: 20px;
      padding-right: 10px;
      font-size: 0.75rem;
    }
  }
`;

export default async function UserPage({ params }: UserPageProps) {
  const { id } = await params;
  const player = await getPlayer(id);

  if (!player) {
    notFound();
  }

  const client = await getMongoClient();
  const metadata = await client
    .db('maimai')
    .collection('metadata')
    .findOne({ _id: 'leaderboard_update' as any });

  const updateDate = metadata?.lastUpdated ? new Date(metadata.lastUpdated) : new Date();
  const lastUpdated = updateDate.toLocaleString('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  const displayName = toNormalWidth(player.name);
  const pastNames = [...new Set((player.old_names ?? []).map(toNormalWidth))].filter(
    (n) => n !== displayName,
  );

  // plain objects only when crossing into the client component
  const history = (player.rank_history ?? []).map((e) => ({
    rank: e.rank,
    rating: e.rating,
    date: new Date(e.date).toISOString(),
  }));

  const rankChange = calculateRankChange(player);
  const ratingChange = calculateRatingChange(player);

  const peak = history.reduce<{ rating: number; date: string | null }>(
    (best, e) => (e.rating > best.rating ? { rating: e.rating, date: e.date } : best),
    { rating: player.rating, date: null },
  );
  const peakDate = peak.date
    ? new Date(peak.date).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' })
    : 'current';

  return (
    <main className="user-container">
      <style>{css}</style>

      <Link href="/" className="back-link">
        ← back to leaderboard
      </Link>

      <header className="user-header">
        <h1 className="user-name">{displayName}</h1>
        {pastNames.length > 0 && (
          <p className="user-aka">formerly known as {pastNames.join(', ')}</p>
        )}
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">rating</span>
          <div
            className="rating-badge"
            style={{ backgroundImage: `url(${getFrameForRating(player.rating)})` }}
          >
            {player.rating}
          </div>
          <span className="stat-sub">
            <Delta value={ratingChange} zeroText="0" /> today
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">rank</span>
          <span className="stat-value">#{player.currentRank ?? '-'}</span>
          <span className="stat-sub">
            <Delta value={rankChange} arrows /> today
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">peak</span>
          <span className="stat-value">{peak.rating}</span>
          <span className="stat-sub">{peakDate}</span>
        </div>
      </section>

      <PlayerHistoryChart data={history} />

      <p className="updated">last updated on {lastUpdated}</p>
    </main>
  );
}