import { formatRating, titleCaseCategory } from "@/lib/format";
import type { Song } from "@/types/domain";

interface SongCardProps {
  song: Song;
  revealRating?: boolean;
  label?: string;
}

export function SongCard({
  song,
  revealRating = false,
  label,
}: SongCardProps) {
  return (
    <article className="song-card">
      <div className="song-artwork">
        {song.artworkUrl ? (
          <img alt={song.title} src={song.artworkUrl} />
        ) : (
          <div className="artwork-fallback">
            <span>{song.musicalTitle.slice(0, 1)}</span>
          </div>
        )}
      </div>

      <div className="song-copy">
        {label ? <span className="eyebrow">{label}</span> : null}
        <h3>{song.title}</h3>
        <p className="song-musical">
          {song.musicalTitle} / {song.artistLabel}
        </p>
        <div className="pill-row">
          <span className="pill">{titleCaseCategory(song.category)}</span>
          <span className="pill">{song.releaseYear}</span>
          <span className="pill">{song.voteCount} votes</span>
          {revealRating ? (
            <span className="pill rating-pill">
              {formatRating(song.eloRating)} Elo
            </span>
          ) : null}
        </div>
        <div className="tag-row">
          {song.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {song.youtubeUrl ? (
        <a
          className="song-link"
          href={song.youtubeUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open on YouTube
        </a>
      ) : null}
    </article>
  );
}
