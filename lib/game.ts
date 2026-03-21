import { GAME_DECK_SIZE } from "./constants.ts";
import type { Song } from "../types/domain.ts";

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }

  return copy;
}

export function buildGameDeck(songs: Song[], size = GAME_DECK_SIZE) {
  const activeSongs = songs.filter((song) => song.status === "active");

  if (activeSongs.length < 2) {
    return [];
  }

  return shuffle(activeSongs).slice(0, Math.min(size, activeSongs.length));
}

export function evaluateGuess(
  currentSong: Song,
  nextSong: Song,
  guess: "higher" | "lower",
) {
  if (guess === "higher") {
    return nextSong.eloRating >= currentSong.eloRating;
  }

  return nextSong.eloRating <= currentSong.eloRating;
}
