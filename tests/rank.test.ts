import test from "node:test";
import assert from "node:assert/strict";

import { demoSongs } from "@/lib/catalog";
import { evaluateGuess } from "@/lib/game";
import { pickRankPair } from "@/lib/rank";

test("pair selection never returns duplicate ids", () => {
  const pair = pickRankPair(demoSongs);

  assert.ok(pair);
  assert.notEqual(pair?.left.id, pair?.right.id);
});

test("game evaluation checks higher correctly", () => {
  const songs = [...demoSongs].sort((a, b) => a.eloRating - b.eloRating);
  const current = songs[0];
  const next = songs[songs.length - 1];

  assert.equal(evaluateGuess(current, next, "higher"), true);
  assert.equal(evaluateGuess(next, current, "higher"), false);
});
