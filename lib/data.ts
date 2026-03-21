import { demoSongs } from "@/lib/catalog";
import { buildGameDeck } from "@/lib/game";
import { isSupabaseConfigured } from "@/lib/env";
import { pickRankPair } from "@/lib/rank";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  GameRun,
  Profile,
  RankPair,
  Song,
  SongFilters,
} from "@/types/domain";
import { DAILY_VOTE_LIMIT } from "@/lib/constants";

interface ViewerState {
  user: {
    id: string;
    email?: string;
  } | null;
  profile: Profile | null;
  isAdmin: boolean;
  remainingVotes: number | null;
}

function mapSongRow(row: Record<string, unknown>): Song {
  return {
    id: String(row.id),
    title: String(row.title),
    musicalTitle: String(row.musical_title),
    category: row.category as Song["category"],
    artistLabel: String(row.artist_label),
    artworkUrl: (row.artwork_url as string | null) ?? null,
    youtubeUrl: (row.youtube_url as string | null) ?? null,
    status: row.status as Song["status"],
    releaseYear: Number(row.release_year),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    eloRating: Number(row.elo_rating),
    voteCount: Number(row.vote_count),
  };
}

function applyFilters(songs: Song[], filters?: SongFilters) {
  return songs.filter((song) => {
    if (filters?.category && filters.category !== "all") {
      if (song.category !== filters.category) {
        return false;
      }
    }

    if (filters?.tag) {
      if (!song.tags.some((tag) => tag.toLowerCase() === filters.tag?.toLowerCase())) {
        return false;
      }
    }

    if (filters?.musicalTitle) {
      if (song.musicalTitle.toLowerCase() !== filters.musicalTitle.toLowerCase()) {
        return false;
      }
    }

    if (filters?.query) {
      const haystack = `${song.title} ${song.musicalTitle} ${song.artistLabel} ${song.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(filters.query.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

export async function listSongs(filters?: SongFilters) {
  if (!isSupabaseConfigured()) {
    return applyFilters(demoSongs, filters).sort((a, b) => b.eloRating - a.eloRating);
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return applyFilters(demoSongs, filters).sort((a, b) => b.eloRating - a.eloRating);
  }

  let query = supabase
    .from("songs")
    .select("*")
    .order("elo_rating", { ascending: false })
    .eq("status", "active");

  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  if (filters?.tag) {
    query = query.contains("tags", [filters.tag]);
  }

  if (filters?.musicalTitle) {
    query = query.ilike("musical_title", filters.musicalTitle);
  }

  if (filters?.query) {
    query = query.or(
      `title.ilike.%${filters.query}%,musical_title.ilike.%${filters.query}%,artist_label.ilike.%${filters.query}%`,
    );
  }

  const { data } = await query;

  return (data ?? []).map((row) => mapSongRow(row));
}

export async function getSongLeaderboard(filters?: SongFilters) {
  return listSongs(filters);
}

export async function getSongCount() {
  const songs = await listSongs();
  return songs.length;
}

export async function getRankPair() {
  const songs = await listSongs();
  return pickRankPair(songs);
}

export async function getGameDeck() {
  const songs = await listSongs();
  return buildGameDeck(songs);
}

export async function getPlayerLeaderboard(limit = 20) {
  if (!isSupabaseConfigured()) {
    return [] satisfies GameRun[];
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return [] satisfies GameRun[];
  }

  const { data: runs } = await supabase
    .from("game_runs")
    .select("id, user_id, score, started_at, ended_at, seed_context")
    .order("score", { ascending: false })
    .order("ended_at", { ascending: true })
    .limit(limit);

  const userIds = [...new Set((runs ?? []).map((run) => run.user_id))];
  let profileMap = new Map<string, string | null>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    profileMap = new Map(
      (profiles ?? []).map((profile) => [
        String(profile.user_id),
        (profile.display_name as string | null) ?? null,
      ]),
    );
  }

  return (runs ?? []).map((run) => ({
    id: String(run.id),
    userId: String(run.user_id),
    score: Number(run.score),
    startedAt: String(run.started_at),
    endedAt: String(run.ended_at),
    seedContext: (run.seed_context as string | null) ?? null,
    displayName: profileMap.get(String(run.user_id)) ?? "Anonymous Ensemble",
  }));
}

export async function getViewerState(): Promise<ViewerState> {
  if (!isSupabaseConfigured()) {
    return {
      user: null,
      profile: null,
      isAdmin: false,
      remainingVotes: null,
    };
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      user: null,
      profile: null,
      isAdmin: false,
      remainingVotes: null,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      profile: null,
      isAdmin: false,
      remainingVotes: null,
    };
  }

  const [{ data: profile }, { data: usage }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, role")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("daily_vote_usage")
      .select("count")
      .eq("user_id", user.id)
      .eq("usage_date", new Date().toISOString().slice(0, 10))
      .maybeSingle(),
  ]);

  const normalizedProfile = profile
    ? {
        userId: String(profile.user_id),
        displayName: (profile.display_name as string | null) ?? null,
        role: profile.role as Profile["role"],
      }
    : null;

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: normalizedProfile,
    isAdmin: normalizedProfile?.role === "admin",
    remainingVotes: DAILY_VOTE_LIMIT - Number(usage?.count ?? 0),
  };
}

export async function getAdminSongs() {
  if (!isSupabaseConfigured()) {
    return demoSongs.sort((a, b) => b.eloRating - a.eloRating);
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return demoSongs.sort((a, b) => b.eloRating - a.eloRating);
  }

  const { data } = await supabase
    .from("songs")
    .select("*")
    .order("status", { ascending: true })
    .order("elo_rating", { ascending: false });

  return (data ?? []).map((row) => mapSongRow(row));
}

export function isDemoMode() {
  return !isSupabaseConfigured();
}

export function getAvailableTags(songs: Song[]) {
  return [...new Set(songs.flatMap((song) => song.tags))].sort((a, b) =>
    a.localeCompare(b),
  );
}
