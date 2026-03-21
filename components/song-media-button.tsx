"use client";

import { useState } from "react";

import { getYouTubeEmbedUrl } from "@/lib/media";
import type { Song } from "@/types/domain";

interface SongMediaButtonProps {
  song: Song;
}

export function SongMediaButton({ song }: SongMediaButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const embedUrl = getYouTubeEmbedUrl(song.youtubeUrl);

  if (!song.youtubeUrl) {
    return null;
  }

  return (
    <>
      <div className="media-action-row">
        {embedUrl ? (
          <button
            className="focus-utility-button"
            onClick={() => setIsOpen(true)}
            type="button"
          >
            Preview
          </button>
        ) : null}
        <a
          className="focus-utility-button"
          href={song.youtubeUrl}
          rel="noreferrer"
          target="_blank"
        >
          YouTube
        </a>
      </div>

      {isOpen ? (
        <div
          className="media-modal-backdrop"
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <div
            className="media-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <button
              className="media-modal-close"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              Close
            </button>

            <div className="media-modal-header">
              <span className="eyebrow">Listening booth</span>
              <h3>{song.title}</h3>
              <p>
                {song.musicalTitle} / {song.artistLabel}
              </p>
            </div>

            {embedUrl ? (
              <div className="media-embed-shell">
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  src={embedUrl}
                  title={`YouTube preview for ${song.title}`}
                />
              </div>
            ) : (
              <div className="notice-panel">
                <strong>Embed preview unavailable for this song link.</strong>
                <p>Use the YouTube button to open the track in a new tab.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
