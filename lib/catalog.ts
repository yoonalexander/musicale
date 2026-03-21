import songs from "@/data/songs.json";
import { BASE_ELO } from "./constants.ts";
import type { Song, SongSeed } from "../types/domain.ts";

const seedSongs = songs as SongSeed[];

export const demoSongs: Song[] = seedSongs.map((song) => ({
  id: song.id,
  title: song.title,
  musicalTitle: song.musicalTitle,
  category: song.category,
  artistLabel: song.artistLabel,
  artworkUrl: song.artworkUrl,
  youtubeUrl: song.youtubeUrl,
  status: song.status ?? "active",
  releaseYear: song.releaseYear,
  tags: song.tags,
  eloRating: song.eloRating ?? BASE_ELO,
  voteCount: song.voteCount ?? 0,
}));
