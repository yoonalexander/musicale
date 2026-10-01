import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await getSupabaseServerClient();
    const result = await supabase?.auth.exchangeCodeForSession(code);
    if (result && !result.error)
      return NextResponse.redirect(`${getSiteUrl()}/today`);
  }

  return NextResponse.redirect(
    `${getSiteUrl()}/login?message=Sign-in+link+expired+or+invalid.+Request+a+new+link.`,
  );
}
