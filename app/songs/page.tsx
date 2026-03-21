import Link from "next/link";

import { getAvailableTags, listSongs } from "@/lib/data";
import { formatRating, titleCaseCategory } from "@/lib/format";

export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const category =
    typeof params.category === "string" ? params.category : "all";
  const query = typeof params.q === "string" ? params.q : "";
  const tag = typeof params.tag === "string" ? params.tag : "";

  const songs = await listSongs({
    category: category === "all" ? "all" : (category as "broadway" | "movie"),
    query,
    tag: tag || undefined,
  });

  const tags = getAvailableTags(songs);

  return (
    <div className="stack-xl">
      <section className="page-intro">
        <div>
          <span className="eyebrow">Catalog</span>
          <h1>Browse the ranked songbook.</h1>
          <p>
            This is a unified list across Broadway and movie musicals. Use
            filters to explore eras, moods, and show types without splitting the
            shared ranking.
          </p>
        </div>
      </section>

      <form className="filter-bar" method="get">
        <input defaultValue={query} name="q" placeholder="Search title, show, artist" />
        <select defaultValue={category} name="category">
          <option value="all">All categories</option>
          <option value="broadway">Broadway</option>
          <option value="movie">Movie musicals</option>
        </select>
        <select defaultValue={tag} name="tag">
          <option value="">All tags</option>
          {tags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="primary-button" type="submit">
          Apply filters
        </button>
      </form>

      <div className="panel">
        <div className="table">
          {songs.map((song, index) => (
            <div className="table-row rich" key={song.id}>
              <span>#{index + 1}</span>
              <div>
                <strong>{song.title}</strong>
                <p>
                  {song.musicalTitle} • {song.artistLabel}
                </p>
                <div className="pill-row">
                  <span className="pill">{titleCaseCategory(song.category)}</span>
                  {song.tags.slice(0, 3).map((songTag) => (
                    <span className="pill" key={songTag}>
                      {songTag}
                    </span>
                  ))}
                </div>
              </div>
              <span>{formatRating(song.eloRating)} Elo</span>
              {song.youtubeUrl ? (
                <a
                  className="ghost-button"
                  href={song.youtubeUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Listen
                </a>
              ) : (
                <span className="muted-label">No link</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
