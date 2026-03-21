import { SongMediaButton } from "@/components/song-media-button";
import { titleCaseCategory } from "@/lib/format";
import type { Song } from "@/types/domain";

interface ImmersiveSongPanelProps {
  song: Song;
  label: string;
  side: "left" | "right";
  metric?: React.ReactNode;
  actions?: React.ReactNode;
}

export function ImmersiveSongPanel({
  song,
  label,
  side,
  metric,
  actions,
}: ImmersiveSongPanelProps) {
  return (
    <article className={`focus-panel focus-panel--${side}`}>
      <div className="focus-panel__backdrop">
        {song.artworkUrl ? (
          <img alt={song.title} src={song.artworkUrl} />
        ) : (
          <div
            className={`focus-panel__fallback focus-panel__fallback--${song.category}`}
          >
            <span>{song.musicalTitle.slice(0, 1)}</span>
          </div>
        )}
      </div>
      <div className="focus-panel__scrim" />

      <div className="focus-panel__content">
        <div className="focus-panel__header">
          <span className="focus-panel__label">{label}</span>
          <div className="focus-panel__chips">
            <span>{titleCaseCategory(song.category)}</span>
            <span>{song.releaseYear}</span>
          </div>
        </div>

        <div className="focus-panel__copy">
          <h2>{song.title}</h2>
          <p>
            {song.musicalTitle} / {song.artistLabel}
          </p>
        </div>

        {metric ? <div className="focus-panel__metric">{metric}</div> : null}

        <div className="focus-panel__footer">
          <SongMediaButton song={song} />
          {actions ? <div className="focus-panel__actions">{actions}</div> : null}
        </div>
      </div>
    </article>
  );
}
