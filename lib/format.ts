export function formatRating(rating: number) {
  return Math.round(rating).toLocaleString();
}

export function titleCaseCategory(category: string) {
  return category === "broadway" ? "Broadway" : "Movie Musical";
}

export function formatTag(tag: string) {
  return tag
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
