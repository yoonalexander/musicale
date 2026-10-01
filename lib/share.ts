export function shareResult(number: number, percent: number, streak: number) {
  return `Musicale #${number}\n\n🎵${percent >= 50 ? "🟩" : "⬛"}\n\nI voted with ${percent}% of listeners.\n🔥 ${streak}-day streak`;
}

export function resultMessage(percent: number) {
  return percent === 50
    ? "An even split. Your vote counts."
    : percent < 50
      ? "You picked the underdog."
      : "You’re with the majority.";
}
