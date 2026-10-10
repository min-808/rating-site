import { cache, Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PlayerHistoryChart from '../../../components/PlayerHistoryChart';
import BestFifty from '../../../components/BestFifty';
import { Best50Stats } from '../../../components/StatsBadge';
import { new15, old35 } from '../../../lib/song-calc';
import FallbackImage from '../../../components/FallbackImage';
import { connectMongo, getMongoClient } from '../../../lib/connect-db';
import {
  type PlayerDocument,
  type SongMetaDocument,
  getFrameForRating,
  calculateRankChange,
  calculateRatingChange,
  toNormalWidth,
} from '../../../lib/leaderboard';
import { versionName } from '../../../lib/versions';
import LevelChart from '../../../components/LevelChart';
import ClaimPanel from '../../../components/ClaimPanel';
import RefreshScores from '../../../components/RefreshScores';
import { getSession } from '../../../lib/auth';
import ProfileBio from '../../../components/ProfileBio';
import PastNames from '../../../components/PastNames';
import ChartsPlayed, { ChartsPlayedLabel } from '../../../components/ChartsPlayed';
import { CHART_DIFFICULTIES, type DifficultyCounts } from '../../../lib/difficulties';
import FavoriteScores from '../../../components/FavoriteScores';
import { playStats } from '../../../lib/play-stats';

interface UserPageProps {
  params: Promise<{ id: string }>;
}

const TZ = 'Pacific/Honolulu';

// keani's user_id
const HEART_USER_ID = '102106637992476';

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

  // alt is empty cuz the name is right next to it
  return (
      <FallbackImage
          src={src}
          fallbackSrc={fallbackSrc}
          alt=""
          className="user-avatar"
          width={88}
          height={88}
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
    max-width: 900px;
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
    margin-bottom: 1.5rem;
  }
  .user-avatar {
    /* about as tall as the plate, name and status line beside it */
    width: 88px;
    height: 88px;
    flex-shrink: 0;
    border-radius: 8px;
    object-fit: cover;
  }
  .user-avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.2rem;
    font-weight: bold;
    color: var(--text-sub);
    background-color: var(--faq-highlight-bg);
  }
  .user-heading {
    min-width: 0;
    flex: 1;
  }

  .user-heart {
    flex-shrink: 0;
    align-self: center;
    margin-left: 0.5rem;
    font-size: 1.6rem;
    line-height: 1;
    color: #e11d48;
    animation: heart-beat 1.8s ease-in-out infinite;
  }
  @keyframes heart-beat {
    0%, 70%, 100% { transform: scale(1); }
    35% { transform: scale(1.15); }
  }
  @media (prefers-reduced-motion: reduce) {
    .user-heart {
      animation: none;
    }
    .user-name-heart {
      animation: none;
    }
  }

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

  .title-plate-bare {
    border-width: 0;
    padding: 4px 12px;
    border-radius: 4px;
    background-color: var(--faq-highlight-bg);
    color: var(--text-sub);
    text-shadow: none;
  }

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
  .user-name-heart {
  background: linear-gradient(90deg, #ff7eb3, #ffbad5, #ff7eb3);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: name-shimmer 2s linear infinite;
}
@keyframes name-shimmer {
  to { background-position: 200% center; }
}
  .user-dan {
    height: 28px;
    width: auto;
    flex-shrink: 0;
  }

  /* the overview card, laid out like an osu! profile:
       left:  rating + rank up top, the history graph, rank pills along the bottom
       right: a panel of label / value rows */
  .overview {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    border: 1px solid var(--border-light);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 1.25rem;
  }
  .ov-main {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
    padding: 1rem 1.25rem 1rem;
  }
  .ov-top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.75rem 2.5rem;
  }
  .ov-stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ov-label {
    font-size: 0.8rem;
    color: var(--text-sub);
  }
  .ov-big {
    font-size: 2rem;
    font-weight: bold;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .ov-sub {
    font-size: 0.8rem;
    color: var(--text-sub);
  }
  /* the rating frame, scaled up to sit level with the big rank number */
  .ov-stat .rating-badge {
    width: 128px;
    height: 36px;
    font-size: 1.15rem;
  }
  .ov-stat .rating-value {
    margin-right: 9px;
  }
  .ov-chart {
    min-width: 0;
  }
  .ov-badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px 10px;
  }
  .ov-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  /* grade images (SSS+, SSS, ...) are all the same height; width follows the image */
  .ov-grade {
    display: block;
    height: 26px;
    width: auto;
  }
  .ov-count {
    font-size: 0.85rem;
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }
  .ov-side {
    border-left: 1px solid var(--border-light);
    background: rgba(127, 127, 127, 0.06);
    padding: 1.1rem 1.25rem;
    display: flex;
    align-items: center;
  }
  .ov-list {
    width: 100%;
    margin: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 1rem;
    font-size: 0.88rem;
  }
  /* thin line between groups: totals, combo badges, sync badges */
  .ov-sep {
    grid-column: 1 / -1;
    height: 1px;
    margin: 2px 0;
    background: var(--border-light);
  }
  .ov-list dt {
    color: var(--text-sub);
  }
  .ov-list dd {
    margin: 0;
    font-weight: bold;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .ov-hidden {
    width: 100%;
    text-align: center;
    font-size: 0.85rem;
    font-style: italic;
    color: var(--text-muted);
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
  .bf-hidden {
    margin: 1.5rem 0;
    text-align: center;
    font-size: 0.9rem;
    font-style: italic;
    color: var(--text-muted);
  }

  /* narrower than a laptop: the side panel moves under the graph */
  @media (max-width: 760px) {
    .overview {
      grid-template-columns: minmax(0, 1fr);
    }
    .ov-side {
      border-left: 0;
      border-top: 1px solid var(--border-light);
    }
    .ov-badges {
      justify-content: center;
    }
  }
  @media (max-width: 600px) {
    .ov-main {
      padding: 0.85rem 0.9rem;
    }
    .ov-big {
      font-size: 1.6rem;
    }
    .ov-stat .rating-badge {
      width: 104px;
      height: 29px;
      font-size: 0.95rem;
    }
    .ov-grade {
      height: 21px;
    }
  }

  @media (max-width: 600px) {
    .user-container {
      padding: 1.25rem 1rem 2rem 1rem;
    }
    .user-header {
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .user-avatar {
      width: 72px;
      height: 72px;
    }
    .user-avatar-fallback {
      font-size: 1.8rem;
    }
    .user-heart {
      font-size: 1.25rem;
      margin-left: 0.35rem;
    }
    .title-plate {
      --plate-cap: 8;
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
    .ov-main {
      padding: 0.85rem 0.75rem;
    }
    .ov-top {
      gap: 0.75rem 1.75rem;
    }
    .ov-big {
      font-size: 1.5rem;
    }
    .ov-badges {
      justify-content: center;
      gap: 8px;
    }
    .ov-grade {
      height: 21px;
    }
    .ov-count {
      font-size: 0.78rem;
    }
    .ov-side {
      padding: 0.85rem 1rem;
    }
    .ov-list {
      font-size: 0.82rem;
      gap: 6px 1rem;
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
    second: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  const displayName = toNormalWidth(player.name);

  const isHeartUser = String(player.user_id) === HEART_USER_ID;

  // who's looking, and whether this profile has an account yet
  const session = await getSession();
  const account = await client
    .db('maimai')
    .collection<{ _id: string; bio?: string; favorites?: string[] }>('accounts')
    .findOne({ _id: String(player.user_id) }, { projection: { _id: 1, bio: 1, favorites: 1 } });
  const isOwner = session?.userId === String(player.user_id);

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

  const optedOut = Boolean(player.scores_opt_out);

  let songs: PlayerDocument['songs'] = [];

  // the "charts by level" totals, for both region views, and the songs the NA view leaves out
  const levelTotals = { na: {} as Record<string, number>, intl: {} as Record<string, number> };
  let naExcluded: string[] = [];
  let playedNa = 0;
  // the same counts split by difficulty, for the popup on "unique charts played"
  const byDifficulty = { na: {} as DifficultyCounts, intl: {} as DifficultyCounts };
  for (const region of ['na', 'intl'] as const) {
    for (const d of CHART_DIFFICULTIES) byDifficulty[region][d] = { played: 0, total: 0 };
  }

  if (!optedOut) {
    const titles = [...new Set((player.songs ?? []).map((s) => s.title))];
    const metaDocs = await client
        .db('maimai')
        .collection<SongMetaDocument>('songmeta')
        .find({ _id: { $in: titles } })
        .toArray();
    const meta = new Map<string, SongMetaDocument>(metaDocs.map((m) => [m._id, m]));

    // same title matching as the scrapers, so full-width titles line up
    const titleKey = (t: string) => toNormalWidth(String(t ?? '')).replace(/\s+/g, ' ').trim().toLowerCase();

    // every song's NA flag (below) and romanized title, for searching the favorites picker
    // by romaji ("umiyuri" finds ウミユリ海底譚). title_romaji comes from rating-scraper/romaji.js
    const songFlags = await client
        .db('maimai')
        .collection<{ title: string; na?: string | number; title_romaji?: string | null }>('songs')
        .find({}, { projection: { title: 1, na: 1, title_romaji: 1 } })
        .toArray();
    const romajiByTitle = new Map<string, string>();
    for (const s of songFlags) if (s.title_romaji) romajiByTitle.set(titleKey(s.title), s.title_romaji);

    songs = (player.songs ?? []).map((s) => {
      // a title shared by songs in different genres (the two "Link"s) keeps each one's
      // jacket and details under its genre, and the score's genre picks which
      const shared = meta.get(s.title);
      const m = shared?.by_genre?.[s.genre ?? ''] ?? shared;
      const title_romaji = romajiByTitle.get(titleKey(s.title)) ?? null;
      return m
  ? {
      ...s,
      title_romaji,
      jacket_blob: m.blob,
      artist: m.artist,
      bpm: m.bpm,
      version: versionName(m.version_code),
      improved_at: s.improved_at ? new Date(s.improved_at).toISOString() : null,
    }
  : { ...s, title_romaji, improved_at: s.improved_at ? new Date(s.improved_at).toISOString() : null };
    });

    // songs not available in North America (na: "0"). a title only counts as
    // excluded if every song with that title is marked, since a few titles are shared
    const availableInNa = new Map<string, boolean>();
    for (const s of songFlags) {
      const key = titleKey(s.title);
      availableInNa.set(key, (availableInNa.get(key) ?? false) || String(s.na) !== '0');
    }
    naExcluded = [...availableInNa].filter(([, ok]) => !ok).map(([key]) => key);
    const excludedSet = new Set(naExcluded);

    // the NA "charts played": the same charts the level chart counts in its NA view
    playedNa = (player.songs ?? []).filter(
        (s) => (s.achievement ?? 0) > 0 && !excludedSet.has(titleKey(s.title)),
    ).length;

    // played charts by difficulty: every one for international, NA-available ones for NA
    for (const s of player.songs ?? []) {
      if (!((s.achievement ?? 0) > 0)) continue;
      const d = String(s.difficulty ?? '').toLowerCase();
      if (byDifficulty.intl[d]) byDifficulty.intl[d].played++;
      if (byDifficulty.na[d] && !excludedSet.has(titleKey(s.title))) byDifficulty.na[d].played++;
    }

    // chart lists per level, saved nightly from maimai NET's own level pages
    const levelDocs = await client
        .db('maimai')
        .collection<{ _id: string; charts?: { title: string; difficulty?: string | null }[] }>('level_charts')
        .find({}, { projection: { charts: 1 } })
        .toArray();

    for (const doc of levelDocs) {
      const charts = doc.charts ?? [];
      levelTotals.intl[doc._id] = charts.length;
      levelTotals.na[doc._id] = charts.filter((c) => !excludedSet.has(titleKey(c.title))).length;
      // and the game's chart counts by difficulty
      for (const c of charts) {
        const d = String(c.difficulty ?? '').toLowerCase();
        if (byDifficulty.intl[d]) byDifficulty.intl[d].total++;
        if (byDifficulty.na[d] && !excludedSet.has(titleKey(c.title))) byDifficulty.na[d].total++;
      }
    }
  }

  // counted from their saved scores, so it's hidden along with them when they opt out.
  // the total is every chart in the game, from the same level pages as the level chart
  const sum = (counts: Record<string, number>) => Object.values(counts).reduce((t, n) => t + n, 0);
  const totalCharts = sum(levelTotals.intl);
  const stats = optedOut ? null : playStats(player.songs, totalCharts);
  // "unique charts played" for both regions; the level chart's toggle picks which shows
  const chartsPlayed = {
    na: { played: playedNa, total: sum(levelTotals.na) },
    intl: { played: stats?.played ?? 0, total: totalCharts },
  };

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
              <h1 className={`user-name${isHeartUser ? ' user-name-heart' : ''}`}>{displayName}</h1>
              <PastNames names={pastNames} />
              <DanBadge src={player.dan_blob} fallbackSrc={player.dan} />
              <DanBadge src={player.class_rank_blob} fallbackSrc={player.class_rank} />
            </div>
            {/* claimed / unclaimed / this is you. the claim flow itself opens in #claim-flow below */}
            <ClaimPanel
                webId={player.web_id}
                playerName={displayName}
                claimed={Boolean(account)}
                isOwner={isOwner}
                signedInAs={session?.username ?? null}
                captchaSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
                flowSlotId="claim-flow"
            />
          </div>
          {isHeartUser && (
              <span className="user-heart" role="img" aria-label="heart">
                ♡ ༘˚·⑅
            </span>
          )}
          {/* the owner's own profile: pull in new scores without waiting for the nightly */}
          {isOwner && !optedOut && <RefreshScores />}
        </header>

        <div id="claim-flow" />

        <section className="overview" aria-label="rating, rank and play stats">
          <div className="ov-main">
            <div className="ov-top">
              <div className="ov-stat">
                <span className="ov-label">rating</span>
                <div
                    className="rating-badge"
                    style={{ backgroundImage: `url(${getFrameForRating(player.rating)})` }}
                >
                  <span className="rating-value">{player.rating}</span>
                </div>
                <span className="ov-sub"><Delta value={ratingChange} zeroText="0" /> today</span>
              </div>

              <div className="ov-stat">
                <span className="ov-label">rank</span>
                <span className="ov-big">#{player.currentRank ?? '-'}</span>
                <span className="ov-sub"><Delta value={rankChange} arrows /> today</span>
              </div>
            </div>

            <div className="ov-chart">
              <PlayerHistoryChart data={history} rating={player.rating} />
            </div>

            {stats && (
              <div className="ov-badges">
                {stats.badges.map((b) => (
                  <div className="ov-badge" key={b.label}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="ov-grade" src={b.img} alt={b.label} title={b.label} height={26} />
                    <span className="ov-count">{b.count.toLocaleString('en-US')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="ov-side">
            {stats ? (
              <dl className="ov-list">
                {stats.side.map((group, g) => (
                  <Fragment key={g}>
                    {g > 0 && <div className="ov-sep" role="presentation" />}
                    {group.map((row) => (
                      <div key={row.label} style={{ display: 'contents' }}>
                        <dt>{row.id === 'charts-played' ? <ChartsPlayedLabel label={row.label} {...byDifficulty} /> : row.label}</dt>
                        <dd>{row.id === 'charts-played' ? <ChartsPlayed {...chartsPlayed} /> : row.value}</dd>
                      </div>
                    ))}
                  </Fragment>
                ))}
              </dl>
            ) : (
              <p className="ov-hidden">play stats hidden</p>
            )}
          </aside>
        </section>

        <ProfileBio initialBio={account?.bio ?? null} canEdit={isOwner} />

        {/* favorite scores, right under the about me: claimed profiles only, and hidden
            with the rest of the scores. the divider below separates it from the level breakdown */}
        {account && !optedOut && (
            <FavoriteScores songs={songs ?? []} initialFavorites={account.favorites ?? []} canEdit={isOwner} />
        )}

        <hr className="divider" />

        {optedOut ? (
        <p className="bf-hidden">best 50 scores hidden</p>
        ) : (
        <>
            <LevelChart songs={songs} totals={levelTotals} naExcluded={naExcluded} />
            <hr className="divider" />
            <Best50Stats b15={new15(songs)} b35={old35(songs)} />
            <BestFifty data={songs} />
        </>
        )}

        <p className="updated">last updated on {lastUpdated}</p>
      </main>
  );
}