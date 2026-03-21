import test from "node:test";
import assert from "node:assert/strict";

import { applyEloResult, expectedScore } from "@/lib/elo";

test("expected score favors the higher-rated song", () => {
  const higher = expectedScore(1400, 1200);
  const lower = expectedScore(1200, 1400);

  assert.ok(higher > lower);
  assert.ok(higher > 0.5);
});

test("elo result raises the winner and lowers the loser", () => {
  const result = applyEloResult(1200, 1200);

  assert.equal(result.winnerRating, 1212);
  assert.equal(result.loserRating, 1188);
  assert.equal(result.winnerDelta, 12);
  assert.equal(result.loserDelta, -12);
});
