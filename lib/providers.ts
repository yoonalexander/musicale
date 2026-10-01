import type { SongProvider } from "@/types/domain";

const hosts: Record<SongProvider["provider"], string[]> = {
  youtube: ["www.youtube.com", "youtube.com", "youtu.be", "music.youtube.com"],
  spotify: ["open.spotify.com"],
  apple_music: ["music.apple.com"],
  musicbrainz: ["musicbrainz.org"],
};
export const providerLabels = {
  youtube: "YouTube",
  spotify: "Spotify",
  apple_music: "Apple Music",
  musicbrainz: "MusicBrainz",
};

export function safeProviderUrl(
  provider: string,
  value: unknown,
): string | null {
  if (typeof value !== "string" || !Object.hasOwn(hosts, provider)) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !hosts[provider as SongProvider["provider"]].includes(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function mapProviders(rows: unknown): SongProvider[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    const externalUrl = safeProviderUrl(r.provider, r.external_url);
    if (!externalUrl) return [];
    return [
      {
        provider: r.provider,
        providerSongId: String(r.provider_song_id),
        externalUrl,
      },
    ];
  });
}
