"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSiteUrl, isSupabaseConfigured } from "@/lib/env";
import { getViewerState } from "@/lib/data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function redirectWith(path: string, params: Record<string, string>): never {
  const search = new URLSearchParams(params);
  redirect(`${path}?${search.toString()}` as never);
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function submitRankVote(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirectWith("/rank", {
      error: "Connect Supabase to record ranking votes.",
    });
  }

  const viewer = await getViewerState();

  if (!viewer.user) {
    redirectWith("/login", {
      message: "Sign in to contribute ranking data.",
    });
  }

  const leftSongId = String(formData.get("leftSongId") ?? "");
  const rightSongId = String(formData.get("rightSongId") ?? "");
  const winnerSongId = String(formData.get("winnerSongId") ?? "");

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    redirectWith("/rank", {
      error: "Supabase client unavailable.",
    });
  }

  const { error } = await supabase.rpc("submit_rank_vote", {
    p_left_song_id: leftSongId,
    p_right_song_id: rightSongId,
    p_winner_song_id: winnerSongId,
  });

  if (error) {
    redirectWith("/rank", {
      error: error.message,
    });
  }

  revalidatePath("/rank");
  revalidatePath("/leaderboard");
  revalidatePath("/songs");

  redirectWith("/rank", {
    flash: "Vote counted. New matchup ready.",
  });
}

export async function requestMagicLinkAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirectWith("/login", {
      message: "Add Supabase environment variables to enable sign-in.",
    });
  }

  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirectWith("/login", {
      message: "Enter an email address to receive a login link.",
    });
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    redirectWith("/login", {
      message: "Supabase client unavailable.",
    });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/api/auth/callback`,
    },
  });

  if (error) {
    redirectWith("/login", {
      message: error.message,
    });
  }

  redirectWith("/login", {
    message: "Magic link sent. Check your inbox.",
  });
}

export async function signOutAction() {
  const supabase = await getSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect("/");
}

export async function submitGameRunAction(input: {
  score: number;
  seedContext?: string | null;
}) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: "Connect Supabase to save high scores.",
    };
  }

  const viewer = await getViewerState();

  if (!viewer.user) {
    return {
      ok: false,
      message: "Sign in to save leaderboard runs.",
    };
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      ok: false,
      message: "Supabase client unavailable.",
    };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("game_runs").insert({
    user_id: viewer.user.id,
    score: input.score,
    started_at: now,
    ended_at: now,
    seed_context: input.seedContext ?? null,
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  revalidatePath("/leaderboard");

  return {
    ok: true,
    message: "Score saved to the leaderboard.",
  };
}

export async function adminUpsertSong(formData: FormData) {
  const viewer = await getViewerState();

  if (!viewer.user || !viewer.isAdmin) {
    redirectWith("/login", {
      message: "Admin access required.",
    });
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    redirectWith("/admin", {
      message: "Supabase is required for admin mutations.",
    });
  }

  const title = String(formData.get("title") ?? "").trim();
  const musicalTitle = String(formData.get("musicalTitle") ?? "").trim();
  const category = String(formData.get("category") ?? "broadway").trim();
  const artistLabel = String(formData.get("artistLabel") ?? "").trim();
  const artworkUrl = String(formData.get("artworkUrl") ?? "").trim();
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim();
  const releaseYear = Number(formData.get("releaseYear") ?? 0);
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  const id =
    String(formData.get("id") ?? "").trim() ||
    `${slugify(title)}-${slugify(musicalTitle)}`;

  const { error } = await supabase.from("songs").upsert({
    id,
    title,
    musical_title: musicalTitle,
    category,
    artist_label: artistLabel,
    artwork_url: artworkUrl || null,
    youtube_url: youtubeUrl || null,
    status: "active",
    release_year: releaseYear,
    tags,
  });

  if (error) {
    redirectWith("/admin", {
      message: error.message,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/songs");
  revalidatePath("/leaderboard");

  redirectWith("/admin", {
    message: "Song saved.",
  });
}

export async function adminToggleSong(formData: FormData) {
  const viewer = await getViewerState();

  if (!viewer.user || !viewer.isAdmin) {
    redirectWith("/login", {
      message: "Admin access required.",
    });
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    redirectWith("/admin", {
      message: "Supabase is required for admin mutations.",
    });
  }

  const songId = String(formData.get("songId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "inactive");

  const { error } = await supabase
    .from("songs")
    .update({
      status: nextStatus,
    })
    .eq("id", songId);

  if (error) {
    redirectWith("/admin", {
      message: error.message,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/rank");
  revalidatePath("/songs");

  redirectWith("/admin", {
    message: "Song status updated.",
  });
}
