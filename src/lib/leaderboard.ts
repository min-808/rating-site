export interface HistoryEntry {
  rating: number;
  date: Date | string;
}

export interface RankHistoryEntry {
  rank: number;
  rating: number;
  date: Date | string;
}

export interface PlayerDocument {
  _id: string;
  user_id: number;
  web_id: number;
  name: string;
  name_half: string;
  rating: number;
  currentRank: number;
  previousRank: number;
  pfp?: string; // profile picture url on maimai (fallback)
  dan?: string; // dan badge image url on maimai (fallback)
  pfp_blob?: string; // profile picture mirrored into vercel blob
  dan_blob?: string; // dan badge mirrored into vercel blob
  title_name?: string; // title text
  title_bg?: string; // title background class, e.g. "trophy_Bronze"
  history?: HistoryEntry[];
  rank_history?: RankHistoryEntry[];
  old_names?: string[];
}

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

export function getFrameForRating(rating: number) {
  const match = ratingFrames.find(r => rating >= r.threshold);
  return match ? match.frame : '/frames/white.png'; // fallback
}

export function toNormalWidth(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ');
}

export function calculateRankChange(player: PlayerDocument): number {
  if (player.rank_history && player.rank_history.length > 1) {
    const latest = player.rank_history[player.rank_history.length - 1].rank;
    const previous = player.rank_history[player.rank_history.length - 2].rank;
    return previous - latest;
  }
  return player.previousRank - player.currentRank;
}

export function calculateRatingChange(player: PlayerDocument): number {
  if (player.history && player.history.length > 1) {
    const latest = player.history[player.history.length - 1].rating;
    const previous = player.history[player.history.length - 2].rating;
    return latest - previous;
  }
  return 0;
}

export function isNewPlayer(player: PlayerDocument, updateDate: Date): boolean {
  if (!player.rank_history || player.rank_history.length === 0) {
    return false;
  }

  const firstEntryDate = new Date(player.rank_history[0].date);

  if (isNaN(firstEntryDate.getTime())) return false; // fallback

  const diffMs = updateDate.getTime() - firstEntryDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours <= 24;
}