import type { RankPair, Song } from "../types/domain.ts";

function randomIndex(max: number) {
  return Math.floor(Math.random() * max);
}

export function pickRankPair(songs: Song[]): RankPair | null {
  const activeSongs = songs.filter((song) => song.status === "active");

  if (activeSongs.length < 2) {
    return null;
  }

  const ordered = [...activeSongs].sort((a, b) => {
    if (a.voteCount !== b.voteCount) {
      return a.voteCount - b.voteCount;
    }

    return Math.abs(a.eloRating - 1200) - Math.abs(b.eloRating - 1200);
  });

  const anchor = ordered[randomIndex(Math.min(ordered.length, 6))];

  const candidates = activeSongs
    .filter((song) => song.id !== anchor.id)
    .sort((a, b) => {
      const aScore =
        Math.abs(a.eloRating - anchor.eloRating) + a.voteCount * 2;
      const bScore =
        Math.abs(b.eloRating - anchor.eloRating) + b.voteCount * 2;

      return aScore - bScore;
    });

  const challenger = candidates[randomIndex(Math.min(candidates.length, 4))];

  if (!challenger) {
    return null;
  }

  return {
    left: anchor,
    right: challenger,
  };
}
