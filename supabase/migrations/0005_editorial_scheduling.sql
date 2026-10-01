begin;
-- Validate links at the database boundary too; imports never make arbitrary server fetches.
alter table song_providers add constraint official_provider_link check(external_url is null or
  case provider
    when 'youtube' then external_url ~ '^https://(www\.youtube\.com|youtube\.com|music\.youtube\.com|youtu\.be)/[^[:space:]]*$'
    when 'spotify' then external_url ~ '^https://open\.spotify\.com/[^[:space:]]*$'
    when 'apple_music' then external_url ~ '^https://music\.apple\.com/[^[:space:]]*$'
    when 'musicbrainz' then external_url ~ '^https://musicbrainz\.org/[^[:space:]]*$'
    else false end) not valid;
-- NOT VALID preserves potentially stale existing editorial data; all new writes are checked.
create function schedule_matchup_batch(p_matchups jsonb) returns integer language plpgsql security invoker set search_path=public as $$
declare m jsonb;d date;n int:=0;inserted int;
begin
 if not is_admin() then raise exception 'Admin access required';end if;
 if jsonb_typeof(p_matchups)<>'array' or jsonb_array_length(p_matchups) not between 1 and 31 then raise exception 'Schedule 1 to 31 matchups';end if;
 for m in select * from jsonb_array_elements(p_matchups) loop
  d:=(m->>'day')::date;
  if d is null or d<(now() at time zone 'UTC')::date then raise exception 'Use today or a future day';end if;
  insert into daily_matchups(matchup_day,song_a_id,song_b_id,starts_at,ends_at,created_by,selection_strategy)
  select d,m->>'songA',m->>'songB',d::timestamp at time zone 'UTC',(d+1)::timestamp at time zone 'UTC',auth.uid(),'editorial'
  where not exists(select 1 from daily_matchups where matchup_day=d)
  on conflict(matchup_day) do nothing;
  get diagnostics inserted=row_count;n:=n+inserted;
 end loop;
 return n;
end $$;
revoke all on function schedule_matchup_batch(jsonb) from public,anon;
grant execute on function schedule_matchup_batch(jsonb) to authenticated;
-- Null is not a display name.
create or replace function update_my_display_name(p_name text) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_name is null or char_length(trim(p_name)) not between 1 and 80 or p_name ~ '[[:cntrl:]]' then raise exception 'Use a name of 1 to 80 characters';end if;
 update profiles set display_name=trim(p_name),updated_at=now() where user_id=auth.uid();
end $$;
commit;
