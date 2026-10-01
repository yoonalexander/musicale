import assert from "node:assert/strict";
import {
  applyEloResult,
  calculateStreak,
  currentStreak,
  expectedScore,
} from "../lib/elo.ts";
import { safeProviderUrl, mapProviders } from "../lib/providers.ts";
import { shareResult, resultMessage } from "../lib/share.ts";
import { validateSong, utcWindow, validDay } from "../lib/validation.ts";
const run = (name: string, fn: () => void) => {
  fn();
  console.log(`PASS ${name}`);
};
run("equal ratings move symmetrically", () => {
  const r = applyEloResult(1500, 1500);
  assert.equal(r.winnerDelta, 12);
  assert.equal(r.loserDelta, -12);
});
run("higher-rated winner gains less", () =>
  assert.ok(applyEloResult(1700, 1400).winnerDelta < 12),
);
run("underdog gains more", () =>
  assert.ok(applyEloResult(1400, 1700).winnerDelta > 12),
);
run("expected scores are stable and complementary", () => {
  const a = expectedScore(1674.2, 1499.7),
    b = expectedScore(1499.7, 1674.2);
  assert.ok(Number.isFinite(a));
  assert.ok(Math.abs(a + b - 1) < 1e-12);
});
run("first vote starts streak", () =>
  assert.deepEqual(calculateStreak(null, 0, 0, "2026-07-12"), {
    current: 1,
    longest: 1,
  }),
);
run("consecutive UTC day increments", () =>
  assert.deepEqual(calculateStreak("2026-07-11", 4, 7, "2026-07-12"), {
    current: 5,
    longest: 7,
  }),
);
run("same day is idempotent", () =>
  assert.deepEqual(calculateStreak("2026-07-12", 4, 7, "2026-07-12"), {
    current: 4,
    longest: 7,
  }),
);
run("missed day resets", () =>
  assert.deepEqual(calculateStreak("2026-07-10", 4, 7, "2026-07-12"), {
    current: 1,
    longest: 7,
  }),
);
run("Elo rounding remains zero sum for half-point ties", () => {
  const r = applyEloResult(1500, 1500, 25);
  assert.equal(r.winnerDelta, 13);
  assert.equal(r.loserDelta, -13);
});
run("expired streak is displayed as zero before another vote", () => {
  assert.equal(currentStreak("2026-09-28", 4, "2026-10-01"), 0);
  assert.equal(currentStreak("2026-09-30", 4, "2026-10-01"), 4);
});
run("streak uses UTC across month and year boundaries", () => {
  assert.equal(calculateStreak("2025-12-31", 3, 3, "2026-01-01").current, 4);
  assert.equal(calculateStreak("2026-09-30", 3, 3, "2026-10-01").current, 4);
});
run("UTC window covers next midnight and validates real dates", () => {
  assert.deepEqual(utcWindow("2026-12-31"), {
    starts_at: "2026-12-31T00:00:00Z",
    ends_at: "2027-01-01T00:00:00.000Z",
  });
  assert.equal(validDay("2026-02-30"), false);
  assert.equal(validDay("2024-02-29"), true);
});
run(
  "provider links reject unsafe schemes, domains and inherited object keys",
  () => {
    assert.equal(
      safeProviderUrl("youtube", "https://www.youtube.com/watch?v=JzqGZjFnYnA"),
      "https://www.youtube.com/watch?v=JzqGZjFnYnA",
    );
    for (const url of [
      "javascript:alert(1)",
      "https://youtube.com.evil.test/",
      "https://user:pass@youtube.com/",
      "http://youtube.com/",
    ])
      assert.equal(safeProviderUrl("youtube", url), null);
    assert.equal(safeProviderUrl("constructor", "https://youtube.com/"), null);
    assert.deepEqual(
      mapProviders([{ provider: "youtube", external_url: null }]),
      [],
    );
  },
);
run(
  "catalog validation rejects duplicate providers and malformed entries",
  () => {
    const song = {
      id: "a-song",
      title: "A song",
      artistName: "Artist",
      releaseYear: 2000,
      providers: [],
    };
    assert.equal(validateSong(song).status, "active");
    assert.throws(() => validateSong({ ...song, id: "../song" }));
    assert.throws(() => validateSong({ ...song, releaseYear: NaN }));
    const provider = {
      provider: "youtube",
      providerSongId: "JzqGZjFnYnA",
      externalUrl: "https://www.youtube.com/watch?v=JzqGZjFnYnA",
    };
    assert.throws(
      () => validateSong({ ...song, providers: [provider, provider] }),
      /only once/,
    );
  },
);
run("share text includes streak and result without song spoilers", () => {
  const text = shareResult(128, 38, 12);
  assert.ok(text.includes("Musicale #128"));
  assert.ok(text.includes("38%"));
  assert.ok(text.includes("12-day streak"));
  assert.ok(!text.includes("Respect"));
  assert.ok(!text.includes("God Only Knows"));
  assert.equal(resultMessage(50), "An even split. Your vote counts.");
});
