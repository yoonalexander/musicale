export function expectedScore(rating: number, opponent: number) {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

export function applyEloResult(winner: number, loser: number, kFactor = 24) {
  const expectedWinner = expectedScore(winner, loser);
  const expectedLoser = expectedScore(loser, winner);
  const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
  const loserDelta = -winnerDelta;
  return {
    expectedWinner,
    winnerDelta,
    loserDelta,
    winnerRating: winner + winnerDelta,
    loserRating: loser + loserDelta,
  };
}

export function calculateStreak(
  lastVoteDay: string | null,
  current: number,
  longest: number,
  day: string,
) {
  if (lastVoteDay === day) return { current, longest };
  const previous = new Date(`${day}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const next =
    lastVoteDay === previous.toISOString().slice(0, 10) ? current + 1 : 1;
  return { current: next, longest: Math.max(longest, next) };
}

// A missed day expires the displayed streak before another vote is submitted.
export function currentStreak(
  lastVoteDay: string | null,
  current: number,
  today: string,
) {
  if (!lastVoteDay) return 0;
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return lastVoteDay === today ||
    lastVoteDay === yesterday.toISOString().slice(0, 10)
    ? current
    : 0;
}
