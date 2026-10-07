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
import JumpIcon from '../components/JumpIcon';
import MilestoneBanner, { type Milestone } from '../components/MilestoneBanner';
import { TIER_MILESTONES } from '../lib/rating-tiers';

export const metadata: Metadata = {
  title: 'Rating Leaderboard - HI Maimai',
  description: 'a rating tracker and leaderboard for hawaii maimai players',
};

export const revalidate = false;

const TZ = 'Pacific/Honolulu';

// every rating badge boundary, including each star medal from 14000 up
const MILESTONES = TIER_MILESTONES;

// how many days of updates the milestone banner covers (today plus the two before it)
const MILESTONE_DAYS = 3;

// how many history entries to load per player: enough to cover MILESTONE_DAYS of nightly
// updates, plus room for any extra single-player runs in between
const HISTORY_ENTRIES = 10;

// the calendar day an update happened on, in hawaii time ("2026-10-03")
const dayOf = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: TZ });

// "today", "yesterday", "2 days ago", counted from the latest update's day
function daysAgoLabel(date: Date, updateDate: Date) {
  const days = Math.round((Date.parse(dayOf(updateDate)) - Date.parse(dayOf(date))) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export default async function LeaderboardPage() {
  await connectMongo();
  const client = await getMongoClient();
  const db = client.db('maimai');

  // fetch
  const rawPlayers = await db
  .collection('players')
  .find(
    {},
    {
      projection: {
        user_id: 1,
        web_id: 1,
        name: 1,
        rating: 1,
        currentRank: 1,
        previousRank: 1,
        old_names: 1,
        rank_change: 1,
        // rank_history is only used for the new badge, so just the first entry
        rank_history: { $slice: 1 },
        // the last few history entries: the final two drive the rating delta, and the
        // rest let the milestone banner look back a few days
        history: { $slice: -HISTORY_ENTRIES },
        // don't fetch songs history lol that'll take way too long
      },
    },
  )
  .sort({ currentRank: 1 })
  .toArray();

  const players = rawPlayers as unknown as PlayerDocument[];

  // update exact time to db
  const metadata = await db.collection('metadata').findOne({ _id: 'leaderboard_update' as any });

  // fallback to current time
  const updateDate = metadata?.lastUpdated ? new Date(metadata.lastUpdated) : new Date();

  const lastUpdated = updateDate.toLocaleString('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  // milestones crossed in the last MILESTONE_DAYS days of updates. each pair of
  // neighbouring history entries is one update; if the rating went from below a
  // milestone to at or above it, that update crossed it
  const earliestDay = dayOf(new Date(updateDate.getTime() - (MILESTONE_DAYS - 1) * 86_400_000));

  const milestones: Milestone[] = players
    .flatMap((player) => {
      const history = player.history ?? [];
      // the best milestone this player crossed in the window, and when
      let best: { milestone: number; date: Date } | null = null;

      for (let i = 1; i < history.length; i++) {
        const date = new Date(history[i].date);
        if (dayOf(date) < earliestDay) continue; // older than the window

        const before = history[i - 1].rating;
        const after = history[i].rating;
        const crossed = MILESTONES.filter((m) => before < m && after >= m);
        if (crossed.length === 0) continue;

        // a big jump past two milestones shows the higher one
        const top = Math.max(...crossed);
        if (!best || top > best.milestone) best = { milestone: top, date };
      }

      if (!best) return [];
      return [{
        name: toNormalWidth(player.name),
        href: `/user/${player.web_id}`,
        milestone: best.milestone,
        rating: player.rating,
        when: daysAgoLabel(best.date, updateDate),
        sortDate: best.date.getTime(),
      }];
    })
    // newest first, then the bigger milestone first within the same day
    .sort((a, b) => b.sortDate - a.sortDate || b.milestone - a.milestone)
    .map(({ sortDate, ...m }) => m);

  return (
    <main className="main-container">
      <style>{`
        .main-container {
          padding: 0 2rem 2rem 2rem;
          max-width: 1000px;
          margin: 0 auto;
          font-family: sans-serif;
        }
        .page-title {
          margin-bottom: 0.25rem;
        }
        .title-end {
          white-space: nowrap;
        }
        .title-icon {
          display: inline-block;
          height: 1em;
          width: auto;
          margin-left: 0.35em;
          vertical-align: -0.12em;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          -webkit-user-drag: none;
        }
        .title-icon.is-jumping {
          animation: none;
        }

        @keyframes icon-jump {
          0%, 100% { transform: translateY(0); }
          30%      { transform: translateY(-0.3em); }
          50%      { transform: translateY(0); }
          65%      { transform: translateY(-0.1em); }
          80%      { transform: translateY(0); }
        }

        .title-icon.is-jumping {
          animation: icon-jump 0.5s ease-out;
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
          .title-icon.is-jumping {
            animation: none;
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

        <br />
      <MilestoneBanner
        milestones={milestones}
        updateKey={milestones.map((m) => `${m.href}:${m.milestone}`).join('|')}
        />

      <h1 className="page-title">
        HI Maimai Rating{' '}
        <span className="title-end">
          Leaderboard
          <JumpIcon src="/favicon.ico" className="title-icon" />
        </span>
      </h1>
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
            // the 24hr change only looks at the last two history entries, same as before
            // the banner started loading a few more
            const ratingChange = calculateRatingChange({ ...player, history: (player.history ?? []).slice(-2) });

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