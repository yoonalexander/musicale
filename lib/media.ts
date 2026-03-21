export function getYouTubeEmbedUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");

    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0];
      return id
        ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`
        : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return id
          ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`
          : null;
      }

      if (parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.split("/")[2];
        return id
          ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`
          : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}
