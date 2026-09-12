import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PlayerHistoryChart from '../../../components/PlayerHistoryChart';
import FallbackImage from '../../../components/FallbackImage';
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

function Avatar({ src, fallbackSrc, name }: { src?: string; fallbackSrc?: string; name: string }) {
  // no icon saved yet: show the first letter of their name instead
  if (!src && !fallbackSrc) {
    return (
      <div className="user-avatar user-avatar-fallback" aria-hidden="true">
        {Array.from(name)[0] ?? '?'}
      </div>
    );
  }

  // alt is empty because the name is right next to it
  return (
    <FallbackImage
      src={src}
      fallbackSrc={fallbackSrc}
      alt=""
      className="user-avatar"
      width={64}
      height={64}
    />
  );
}

function DanBadge({ src, fallbackSrc }: { src?: string; fallbackSrc?: string }) {
  if (!src && !fallbackSrc) return null;

  return (
    <FallbackImage src={src} fallbackSrc={fallbackSrc} alt="dan badge" className="user-dan" height={28} />
  );
}

function TitlePlate({ name, plate }: { name?: string; plate?: string }) {
  if (!name) return null;

  const text = toNormalWidth(name);

  return (
    <div
      className={`title-plate${plate ? '' : ' title-plate-bare'}`}
      style={plate ? { borderImageSource: `url(${plate})` } : undefined}
      title={text}
    >
      {text}
    </div>
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
    display: flex;
    align-items: center;
    gap: 1rem;
    border-bottom: 1px solid #ccc;
    padding-bottom: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .user-avatar {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    border-radius: 8px;
    object-fit: cover;
  }
  .user-avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6rem;
    font-weight: bold;
    color: var(--text-sub);
    background-color: var(--faq-highlight-bg);
  }
  .user-heading {
    min-width: 0;
    flex: 1;
  }

  /* title plate, sits above the name.
     the plate art is drawn with border-image so the rounded caps keep their
     shape at any width and only the middle stretches.
     --plate-cap is how many pixels of the source png each cap takes up:
     raise it if the curve still looks cut off, lower it if the ends look fat */
  .title-plate {
    --plate-cap: 10;
    display: inline-block;
    max-width: 100%;
    box-sizing: border-box;
    margin-bottom: 0.35rem;
    padding: 4px 2px;

    border-style: solid;
    border-width: 0 calc(var(--plate-cap) * 1px);
    border-color: transparent;
    border-image-source: none;
    border-image-slice: 0 var(--plate-cap) fill;
    border-image-width: 0 calc(var(--plate-cap) * 1px);
    border-image-repeat: stretch;

    font-size: 0.8rem;
    font-weight: bold;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: top;
    color: #fff;
    text-shadow: -1px -1px 0 black,
                  1px -1px 0 black,
                 -1px  1px 0 black,
                  1px  1px 0 black;
  }
  /* no plate image saved: plain neutral chip so the text stays readable */
  .title-plate-bare {
    border-width: 0;
    padding: 4px 12px;
    border-radius: 4px;
    background-color: var(--faq-highlight-bg);
    color: var(--text-sub);
    text-shadow: none;
  }

  /* name + dan badge on one line, dan drops below if the name is long */
  .user-name-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem 0.6rem;
  }
  .user-name {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .user-dan {
    height: 28px;
    width: auto;
    flex-shrink: 0;
  }
  .user-aka {
    margin: 0.35rem 0 0 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 220px));
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }
  .stat-card {
    border: 1px solid var(--border-light);
    border-radius: 8px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
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
    padding-right: 0;
    box-sizing: border-box;
    filter: var(--badge-filter) drop-shadow(0px 0px 5px rgba(255, 255, 255, 0.3));
  }
  .rating-value {
    margin-right: 7px;
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
    .user-header {
      gap: 0.75rem;
    }
    .user-avatar {
      width: 48px;
      height: 48px;
    }
    .user-avatar-fallback {
      font-size: 1.2rem;
    }
    .title-plate {
      --plate-cap: 16;
      font-size: 0.7rem;
      padding: 3px 2px;
      margin-bottom: 0.25rem;
    }
    .title-plate-bare {
      padding: 3px 10px;
    }
    .user-name {
      font-size: 1.5rem;
    }
    .user-dan {
      height: 22px;
    }
    .stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
      padding-right: 0;
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

  return (
    <main className="user-container">
      <style>{css}</style>

      <Link href="/" className="back-link">
        ← back to leaderboard
      </Link>

      <header className="user-header">
        <Avatar src={player.pfp_blob} fallbackSrc={player.pfp} name={displayName} />
        <div className="user-heading">
          <TitlePlate name={player.title_name} plate={player.title_blob} />
          <div className="user-name-row">
            <h1 className="user-name">{displayName}</h1>
            <DanBadge src={player.dan_blob} fallbackSrc={player.dan} />
          </div>
          {pastNames.length > 0 && (
            <p className="user-aka">formerly known as {pastNames.join(', ')}</p>
          )}
        </div>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">rating</span>
          <div
            className="rating-badge"
            style={{ backgroundImage: `url(${getFrameForRating(player.rating)})` }}
          >
            <span className="rating-value">{player.rating}</span>
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
      </section>

      <PlayerHistoryChart data={history} />

      <p className="updated">last updated on {lastUpdated}</p>
    </main>
  );
}