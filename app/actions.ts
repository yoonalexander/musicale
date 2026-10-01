"use server";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/data";
import {
  songId,
  utcWindow,
  validateSong,
  type SongInput,
} from "@/lib/validation";
import { requireAdmin } from "@/lib/auth";

const go = (path: string, key: string, value: string): never =>
  redirect(`${path}?${key}=${encodeURIComponent(value)}` as Route);
export async function requestMagicLinkAction(fd: FormData) {
  if (!isSupabaseConfigured())
    go("/login", "message", "Configure Supabase to enable sign in.");
  const email = String(fd.get("email") ?? "").trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    go("/login", "message", "Enter a valid email address.");
  const db = await getSupabaseServerClient();
  const { error } = await db!.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${getSiteUrl()}/api/auth/callback` },
  });
  go(
    "/login",
    "message",
    error
      ? "Could not send a sign-in link. Try again shortly."
      : "Magic link sent. Check your inbox.",
  );
}
export async function signOutAction() {
  const db = await getSupabaseServerClient();
  await db?.auth.signOut();
  redirect("/");
}
export async function submitDailyVote(fd: FormData) {
  if (!isSupabaseConfigured())
    go("/today", "error", "Connect Supabase to record votes.");
  const viewer = await getViewerState();
  if (!viewer.user) go("/login", "message", "Sign in before voting.");
  const matchupId = String(fd.get("matchupId") ?? "");
  const selectedSongId = String(fd.get("selectedSongId") ?? "");
  if (
    !/^[0-9a-f-]{36}$/i.test(matchupId) ||
    !/^[a-z0-9][a-z0-9-]{0,99}$/.test(selectedSongId)
  )
    go("/today", "error", "Invalid vote. Reload today’s matchup.");
  const db = await getSupabaseServerClient();
  const { error } = await db!.rpc("submit_daily_vote", {
    p_matchup_id: matchupId,
    p_selected_song_id: selectedSongId,
  });
  if (error) {
    const known = [
      "already voted",
      "not active",
      "not in this matchup",
      "Both songs must be active",
      "Playback is unavailable",
    ];
    go(
      "/today",
      "error",
      known.some((s) => error.message.includes(s))
        ? error.message
        : "Could not record your vote. Please try again.",
    );
  }
  revalidatePath("/today");
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  revalidatePath("/songs/[id]", "page");
  redirect("/today");
}
export async function scheduleMatchup(fd: FormData) {
  const v = await requireAdmin();
  let values;
  try {
    const day = String(fd.get("day") ?? "");
    const a = songId(String(fd.get("songA") ?? "")),
      b = songId(String(fd.get("songB") ?? ""));
    if (a === b) throw new Error("Choose two different songs.");
    if (day < new Date().toISOString().slice(0, 10))
      throw new Error("Schedule today or a future day.");
    values = {
      matchup_day: day,
      ...utcWindow(day),
      song_a_id: a,
      song_b_id: b,
      created_by: v.user!.id,
      status: "scheduled",
      selection_strategy: "editorial",
    };
  } catch (error) {
    go("/admin", "message", (error as Error).message);
  }
  const db = await getSupabaseServerClient();
  const replacement = String(fd.get("replaceId") ?? "");
  const { error, data } = replacement
    ? await db!
        .from("daily_matchups")
        .update(values)
        .eq("id", replacement)
        .gt("starts_at", new Date().toISOString())
        .select("id")
        .maybeSingle()
    : await db!.from("daily_matchups").insert(values).select("id").single();
  revalidatePath("/today");
  revalidatePath("/admin");
  go(
    "/admin",
    "message",
    error || !data
      ? error?.code === "23505"
        ? "That day already has a matchup."
        : "Could not schedule. Choose active songs with playback links and a future unvoted matchup."
      : "Matchup saved.",
  );
}
export async function importSongs(fd: FormData) {
  await requireAdmin();
  let songs: SongInput[] = [];
  try {
    const text = String(fd.get("catalog") ?? "");
    if (text.length > 200000)
      throw new Error("Import must be smaller than 200 KB.");
    const rows = JSON.parse(text);
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100)
      throw new Error("Import 1 to 100 songs at a time.");
    songs = rows.map(validateSong);
    if (new Set(songs.map((s) => s.id)).size !== songs.length)
      throw new Error("Duplicate song IDs in import.");
  } catch (error) {
    go(
      "/admin",
      "message",
      error instanceof SyntaxError
        ? "Enter valid JSON."
        : (error as Error).message,
    );
  }
  const db = await getSupabaseServerClient();
  const { error } = await db!.rpc("save_catalog", { p_songs: songs });
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/today");
  revalidatePath("/songs/[id]", "page");
  go(
    "/admin",
    "message",
    error
      ? "Import failed; no songs were changed. Check provider IDs for duplicates."
      : `${songs.length} songs saved.`,
  );
}
export async function updateSongStatus(fd: FormData) {
  await requireAdmin();
  const status = String(fd.get("status"));
  if (!["active", "unavailable", "disabled"].includes(status))
    go("/admin", "message", "Invalid status.");
  let id;
  try {
    id = songId(String(fd.get("id")));
  } catch {
    go("/admin", "message", "Invalid song ID.");
  }
  const db = await getSupabaseServerClient();
  const { error } = await db!
    .from("songs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/today");
  revalidatePath("/leaderboard");
  go(
    "/admin",
    "message",
    error ? "Could not change song status." : "Song status saved.",
  );
}
export async function updateKFactor(fd: FormData) {
  await requireAdmin();
  const k = Number(fd.get("kFactor"));
  if (!Number.isInteger(k) || k < 1 || k > 100)
    go("/admin", "message", "K-factor must be an integer between 1 and 100.");
  const db = await getSupabaseServerClient();
  const { error } = await db!
    .from("app_settings")
    .update({ elo_k_factor: k })
    .eq("id", true);
  revalidatePath("/admin");
  go(
    "/admin",
    "message",
    error ? "Could not save K-factor." : "K-factor saved for future votes.",
  );
}
