import Link from 'next/link';
import type { Metadata } from 'next';
import { connectMongo, getMongoClient } from '../lib/connect-db';
import LeaderboardRow from '../components/LeaderboardRow';
import {
  type PlayerDocument,
  getFrameForRating,
  toNormalWidth,
  calculateRankChange,
  calculateRatingChange,
  isNewPlayer,
} from '../lib/leaderboard';

export const metadata: Metadata = {
  title: 'Rating Leaderboard - HI Maimai',
  description: 'a rating tracker and leaderboard for hawaii maimai players',
};

export const revalidate = false;

export default async function LeaderboardPage() {
  await connectMongo();
  const client = await getMongoClient();
  const db = client.db('maimai');

  // fetch
  const rawPlayers = await db
    .collection('players')
    .find({})
    .sort({ currentRank: 1 })
    .toArray();

  const players = rawPlayers as unknown as PlayerDocument[];

  // update exact time to db
  const metadata = await db.collection('metadata').findOne({ _id: 'leaderboard_update' as any });

  // fallback to current time
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
    <main className="main-container">
      <style>{`
        .main-container {
          padding: 0 2rem 2rem 2rem;
          max-width: 1000px;
          margin: 0 auto;
          font-family: sans-serif;
        }
        .leaderboard-table {
          width: 100%;
          border-collapse: collapse;
        }
        .leaderboard-table th, .leaderboard-table td {
          padding: 10px 8px;
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
          filter: var(--badge-filter) drop-shadow(0px 0px 5px rgba(255, 255, 255, 0.3));
        }
        .header-subtext {
          font-weight: normal;
          font-size: 0.8rem;
          color: var(--text-sub);
        }

        /* clickable rows */
        .lb-row {
          border-bottom: 1px solid var(--border-light);
          cursor: pointer;
          transition: background-color 0.12s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .lb-row:active {
          background-color: rgba(37, 99, 235, 0.12);
        }
        .player-link {
          color: inherit;
          text-decoration: none;
          transition: color 0.12s ease;
        }
        .player-link:focus-visible {
          color: #2563eb;
          outline: 2px solid #2563eb;
          outline-offset: 2px;
          border-radius: 2px;
        }
        .row-chevron {
          width: 1.25rem;
          text-align: right;
          font-size: 1.2rem;
          line-height: 1;
          color: var(--text-sub);
          opacity: 0.45;
          transition: opacity 0.12s ease, color 0.12s ease, transform 0.12s ease;
        }
        /* hover styles only on devices that actually hover, so taps don't leave rows stuck highlighted */
        @media (hover: hover) {
          .lb-row:hover {
            background-color: rgba(37, 99, 235, 0.06);
          }
          .lb-row:hover .player-link {
            color: #2563eb;
          }
          .lb-row:hover .row-chevron {
            opacity: 1;
            color: #2563eb;
            transform: translateX(2px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .lb-row, .player-link, .row-chevron {
            transition: none;
          }
          .lb-row:hover .row-chevron {
            transform: none;
          }
        }

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
          background-color: var(--tooltip-bg);
          color: var(--tooltip-text);
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
          border-color: var(--tooltip-bg) transparent transparent transparent;
        }
        .tooltip-container:hover .tooltip-box {
          visibility: visible;
          opacity: 1;
        }

        @media (max-width: 600px) {
          .main-container {
            padding: 0 0.5rem 1rem 0.5rem;
          }
          .leaderboard-table th, .leaderboard-table td {
            padding: 8px 3px;
            font-size: 0.8rem;
          }
          .rating-badge {
            width: 70px;
            height: 20px;
            padding-right: 10px;
            font-size: 0.75rem;
          }
          .header-subtext {
            display: block;
            font-size: 0.7rem;
          }
          .leaderboard-table td.row-chevron {
            width: 0.75rem;
            font-size: 1rem;
            opacity: 0.6;
          }
        }
      `}</style>

      <h1 style={{ marginBottom: '0.25rem' }}>HI Maimai Rating Leaderboard</h1>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1.5rem' }}>
        There are currently <b>{players.length}</b> players on the leaderboard
        <br />
        <br />
        Last updated on {lastUpdated}
        <br />
        Automatically updates every day at midnight
      </p>

      <table className="leaderboard-table">
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-strong)' }}>
            <th>Rank</th>
            <th>Player</th>
            <th style={{ textAlign: 'center' }}>Rating</th>
            <th style={{ textAlign: 'center' }}>
              Rank Change <span className="header-subtext">(24hr)</span>
            </th>
            <th style={{ textAlign: 'center' }}>
              Rating Change <span className="header-subtext">(24hr)</span>
            </th>
            <th aria-hidden="true"></th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => {
            const rankChange = calculateRankChange(player);
            const ratingChange = calculateRatingChange(player);

            const isNew = isNewPlayer(player, updateDate);

            const displayName = toNormalWidth(player.name);
            const rawPastNames = player.old_names || [];
            const pastNames = [...new Set(rawPastNames.map(toNormalWidth))];
            // pastNames = pastNames.filter(name => name.toLowerCase() !== displayName.toLowerCase()); // filter out casing name changes, idk if ill include this

            const href = `/user/${player.web_id}`;

            return (
              <LeaderboardRow key={player._id} href={href}>
                <td>#{index + 1}</td>

                <td style={{ fontWeight: 'bold' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {pastNames.length > 0 ? (
                      <div className="tooltip-container">
                        <Link href={href} className="player-link">{displayName}</Link>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginLeft: '6px' }}>📜</span>

                        <div className="tooltip-box">
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px solid var(--tooltip-border)', paddingBottom: '2px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            formerly known as
                          </div>
                          {pastNames.map((name, idx) => (
                            <div key={idx} style={{ padding: '2px 0' }}>• {name}</div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Link href={href} className="player-link">{displayName}</Link>
                    )}

                    {isNew && (
                      <span style={{
                        marginLeft: '8px',
                        backgroundColor: 'var(--rating-loss)',
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

                <td style={{ textAlign: 'center' }}>
                  <div
                    className="rating-badge"
                    style={{ backgroundImage: `url(${getFrameForRating(player.rating)})` }}
                  >
                    {player.rating}
                  </div>
                </td>

                <td style={{ textAlign: 'center' }}>
                  {rankChange > 0 ? (
                    <span style={{ color: 'var(--rating-gain)', fontWeight: '500' }}>▲ +{rankChange}</span>
                  ) : rankChange < 0 ? (
                    <span style={{ color: 'var(--rating-loss)', fontWeight: '500' }}>▼ -{Math.abs(rankChange)}</span>
                  ) : (
                    <span style={{ color: 'var(--text-sub)' }}>-</span>
                  )}
                </td>

                <td style={{ textAlign: 'center' }}>
                  {ratingChange > 0 ? (
                    <span style={{ color: 'var(--rating-gain)', fontWeight: '500' }}>+{ratingChange.toLocaleString()}</span>
                  ) : ratingChange < 0 ? (
                    <span style={{ color: 'var(--rating-loss)', fontWeight: '500' }}>{ratingChange.toLocaleString()}</span>
                  ) : (
                    <span style={{ color: 'var(--text-sub)' }}>0</span>
                  )}
                </td>

                <td className="row-chevron" aria-hidden="true">›</td>
              </LeaderboardRow>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}