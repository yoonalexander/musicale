export type SongCategory = "broadway" | "movie";
export type SongStatus = "active" | "inactive";
export type UserRole = "user" | "admin";

export interface Song {
  id: string;
  title: string;
  musicalTitle: string;
  category: SongCategory;
  artistLabel: string;
  artworkUrl: string | null;
  youtubeUrl: string | null;
  status: SongStatus;
  releaseYear: number;
  tags: string[];
  eloRating: number;
  voteCount: number;
}

export interface VoteRecord {
  id: string;
  userId: string;
  leftSongId: string;
  rightSongId: string;
  winnerSongId: string;
  loserSongId: string;
  ratingDeltaWinner: number;
  ratingDeltaLoser: number;
  createdAt: string;
}

export interface Profile {
  userId: string;
  displayName: string | null;
  role: UserRole;
}

export interface GameRun {
  id: string;
  userId: string;
  score: number;
  startedAt: string;
  endedAt: string;
  seedContext: string | null;
  displayName?: string | null;
}

export interface SongFilters {
  category?: SongCategory | "all";
  tag?: string;
  query?: string;
  musicalTitle?: string;
}

export interface RankPair {
  left: Song;
  right: Song;
}

export interface VoteResult {
  ok: boolean;
  message: string;
}

export interface SongSeed {
  id: string;
  title: string;
  musicalTitle: string;
  category: SongCategory;
  artistLabel: string;
  artworkUrl: string | null;
  youtubeUrl: string | null;
  releaseYear: number;
  tags: string[];
  eloRating?: number;
  voteCount?: number;
  status?: SongStatus;
}
