import songs from "@/data/songs.json";
import type { Matchup, Song } from "@/types/domain";

export const demoSongs = (songs as Array<Record<string, unknown>>).map(
  (s): Song => ({
    id: String(s.id),
    title: String(s.title),
    artistName: String(s.artistName),
    albumName: String(s.albumName),
    artworkUrl: null,
    releaseYear: Number(s.releaseYear),
    genre: String(s.genre),
    eloRating: 1500,
    wins: 0,
    losses: 0,
    matchupCount: 0,
    status: "active",
    providers: (s.providers ?? []) as Song["providers"],
  }),
);

export function demoMatchup(): Matchup {
  const day = new Date().toISOString().slice(0, 10);
  return {
    id: "demo-today",
    matchupDay: day,
    number: 1,
    startsAt: `${day}T00:00:00Z`,
    endsAt: new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString(),
    songA: demoSongs[0],
    songB: demoSongs[1],
    totalVotes: 0,
    songAVotes: 0,
    songBVotes: 0,
    selectedSongId: null,
  };
}
