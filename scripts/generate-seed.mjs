import { readFileSync, writeFileSync } from "node:fs";
const songs = JSON.parse(readFileSync("data/songs.json", "utf8"));
const quote = (s) => `'${String(s).replaceAll("'", "''")}'`;
const rows = songs.map(
  (s) =>
    `(${[s.id, s.title, s.title.toLowerCase(), s.artistName, s.artistName.toLowerCase(), s.albumName].map(quote).join(",")},${s.releaseYear},${quote(s.genre)})`,
);
const providers = songs.flatMap((s) =>
  s.providers.map(
    (p) =>
      `(${[s.id, p.provider, p.providerSongId, p.externalUrl].map(quote).join(",")})`,
  ),
);
writeFileSync(
  "supabase/seed.sql",
  `-- Generated from data/songs.json. Preserve editorial changes and all ratings on repeat runs.
insert into public.songs(id,title,normalized_title,artist_name,normalized_artist_name,album_name,release_year,genre) values
${rows.join(",\n")} on conflict(id) do nothing;
-- Official source links documented in docs/CATALOG.md; audio and artwork are not copied.
insert into public.song_providers(song_id,provider,provider_song_id,external_url) values
${providers.join(",\n")} on conflict(song_id,provider) do nothing;
insert into public.daily_matchups(matchup_day,song_a_id,song_b_id,starts_at,ends_at,status,selection_strategy)
select (now() at time zone 'UTC')::date,'respect-aretha','god-only-knows',
 date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',
 (date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC','scheduled','editorial'
where not exists(select 1 from public.daily_matchups where matchup_day=(now() at time zone 'UTC')::date)
on conflict(matchup_day) do nothing;
`,
);
