import { K_FACTOR } from "./constants.ts";

export function expectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function applyEloResult(
  winnerRating: number,
  loserRating: number,
  kFactor = K_FACTOR,
) {
  const expectedWinner = expectedScore(winnerRating, loserRating);
  const expectedLoser = expectedScore(loserRating, winnerRating);

  const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
  const loserDelta = Math.round(kFactor * (0 - expectedLoser));

  return {
    winnerDelta,
    loserDelta,
    winnerRating: winnerRating + winnerDelta,
    loserRating: loserRating + loserDelta,
  };
}
