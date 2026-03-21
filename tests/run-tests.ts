import assert from "node:assert/strict";

import { applyEloResult, expectedScore } from "../lib/elo.ts";
import { evaluateGuess } from "../lib/game.ts";
import { pickRankPair } from "../lib/rank.ts";
import type { Song } from "../types/domain.ts";

const demoSongs: Song[] = [
  {
    id: "song-a",
    title: "Song A",
    musicalTitle: "Show A",
    category: "broadway",
    artistLabel: "Cast A",
    artworkUrl: null,
    youtubeUrl: null,
    status: "active",
    releaseYear: 2000,
    tags: ["anthem"],
    eloRating: 1200,
    voteCount: 3,
  },
  {
    id: "song-b",
    title: "Song B",
    musicalTitle: "Show B",
    category: "movie",
    artistLabel: "Cast B",
    artworkUrl: null,
    youtubeUrl: null,
    status: "active",
    releaseYear: 2001,
    tags: ["ballad"],
    eloRating: 1240,
    voteCount: 6,
  },
  {
    id: "song-c",
    title: "Song C",
    musicalTitle: "Show C",
    category: "broadway",
    artistLabel: "Cast C",
    artworkUrl: null,
    youtubeUrl: null,
    status: "active",
    releaseYear: 2002,
    tags: ["duet"],
    eloRating: 1180,
    voteCount: 1,
  },
];

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("expected score favors the higher-rated song", () => {
  const higher = expectedScore(1400, 1200);
  const lower = expectedScore(1200, 1400);

  assert.ok(higher > lower);
  assert.ok(higher > 0.5);
});

run("elo result raises the winner and lowers the loser", () => {
  const result = applyEloResult(1200, 1200);

  assert.equal(result.winnerRating, 1212);
  assert.equal(result.loserRating, 1188);
  assert.equal(result.winnerDelta, 12);
  assert.equal(result.loserDelta, -12);
});

run("pair selection never returns duplicate ids", () => {
  const pair = pickRankPair(demoSongs);

  assert.ok(pair);
  assert.notEqual(pair?.left.id, pair?.right.id);
});

run("game evaluation checks higher correctly", () => {
  const songs = [...demoSongs].sort((a, b) => a.eloRating - b.eloRating);
  const current = songs[0];
  const next = songs[songs.length - 1];

  assert.equal(evaluateGuess(current, next, "higher"), true);
  assert.equal(evaluateGuess(next, current, "higher"), false);
});

console.log("All tests passed.");
