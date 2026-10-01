export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export function isSupabaseConfigured() {
  if (Boolean(env.supabaseUrl) !== Boolean(env.supabaseAnonKey))
    throw new Error(
      "Set both Supabase URL and anon key, or leave both empty for preview mode.",
    );
  if (env.supabaseUrl) {
    const url = new URL(env.supabaseUrl);
    if (!["https:", "http:"].includes(url.protocol))
      throw new Error("Supabase URL must use HTTP or HTTPS.");
  }
  if (process.env.MUSICALE_TIMEZONE && process.env.MUSICALE_TIMEZONE !== "UTC")
    throw new Error(
      "Musicale's daily reset is UTC. Other time zones are not supported.",
    );
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function getSiteUrl() {
  const url = new URL(env.siteUrl);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Site URL must be an HTTP or HTTPS origin.");
  return url.origin;
}
