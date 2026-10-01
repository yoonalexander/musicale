import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json(
        { status: "preview" },
        { headers: { "Cache-Control": "no-store" } },
      );
    const db = await getSupabaseServerClient();
    const { error } = await db!.from("song_catalog").select("id").limit(1);
    return NextResponse.json(
      { status: error ? "unavailable" : "ready" },
      { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
