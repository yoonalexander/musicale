begin;
-- A full UTC day is [midnight, next midnight); settings belong to the database.
alter table daily_matchups add constraint utc_window check (
  starts_at=matchup_day::timestamp at time zone 'UTC' and ends_at=(matchup_day+1)::timestamp at time zone 'UTC'
);
alter table songs add constraint valid_record check(wins>=0 and losses>=0 and matchup_count=wins+losses);
alter table songs add constraint valid_song_id check(id ~ '^[a-z0-9][a-z0-9-]{0,99}$');
alter table songs add constraint valid_title check(char_length(title) between 1 and 200);
alter table songs add constraint valid_artist check(char_length(artist_name) between 1 and 200);
alter table song_providers add constraint one_provider_per_song unique(song_id,provider);
alter table votes add constraint valid_choices check(selected_song_id<>rejected_song_id
  and selected_song_id in(song_a_id,song_b_id) and rejected_song_id in(song_a_id,song_b_id));
create table app_settings(id boolean primary key default true check(id),elo_k_factor integer not null default 24 check(elo_k_factor between 1 and 100));
insert into app_settings default values;
create table admin_audit_log (
  id bigint generated always as identity primary key,actor_id uuid references auth.users(id),
  entity text not null,entity_id text not null,operation text not null,before_value jsonb,after_value jsonb,created_at timestamptz not null default now()
);
alter table app_settings enable row level security;
alter table admin_audit_log enable row level security;
create policy admin_settings on app_settings for all using(public.is_admin()) with check(public.is_admin());
create policy admin_audit on admin_audit_log for select using(public.is_admin());
drop policy "own profile update" on profiles;
drop policy "public read matchups" on daily_matchups;
-- Roles and server-computed statistics cannot be changed by profile owners.
revoke all on profiles,votes,rating_events,user_daily_activity,song_rating_snapshots,admin_audit_log from anon,authenticated;
grant select on profiles,votes,rating_events,user_daily_activity,admin_audit_log to authenticated;
grant select on song_rating_snapshots to anon,authenticated;
grant select,insert,update,delete on songs,song_providers,daily_matchups to authenticated;
grant select on songs,song_providers to anon;
grant select,update on app_settings to authenticated;

create function audit_admin_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- Voting updates are audited by rating_events, editorial changes by this log.
  if auth.uid() is not null and public.is_admin() and
    (TG_TABLE_NAME<>'songs' or TG_OP<>'UPDATE' or
      (to_jsonb(new)-array['elo_rating','wins','losses','matchup_count','updated_at'])<>
      (to_jsonb(old)-array['elo_rating','wins','losses','matchup_count','updated_at'])) then
    insert into admin_audit_log(actor_id,entity,entity_id,operation,before_value,after_value)
    values(auth.uid(),TG_TABLE_NAME,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id'),TG_OP,to_jsonb(old),to_jsonb(new));
  end if;
  return coalesce(new,old);
end $$;
create trigger songs_admin_audit after insert or update or delete on songs for each row execute function audit_admin_change();
create trigger providers_admin_audit after insert or update or delete on song_providers for each row execute function audit_admin_change();
create trigger matchups_admin_audit after insert or update or delete on daily_matchups for each row execute function audit_admin_change();
create trigger settings_admin_audit after update on app_settings for each row execute function audit_admin_change();

create function validate_matchup() returns trigger language plpgsql set search_path=public as $$
begin
  if TG_OP='UPDATE' and (old.starts_at<=now() or exists(select 1 from votes where matchup_id=old.id))
    and (new.song_a_id<>old.song_a_id or new.song_b_id<>old.song_b_id or new.matchup_day<>old.matchup_day
      or new.starts_at<>old.starts_at or new.ends_at<>old.ends_at) then
    raise exception 'Only future unvoted matchups can be replaced';
  end if;
  if TG_OP='INSERT' or new.song_a_id<>old.song_a_id or new.song_b_id<>old.song_b_id then
    if (select count(*) from songs s where s.id in(new.song_a_id,new.song_b_id) and s.status='active'
      and exists(select 1 from song_providers p where p.song_id=s.id and p.provider in('youtube','spotify','apple_music') and p.external_url is not null))<>2 then
      raise exception 'Choose two active songs with playback providers';
    end if;
  end if;
  return new;
end $$;
create trigger validate_matchup before insert or update on daily_matchups for each row execute function validate_matchup();

drop function get_today_matchup();
create function get_today_matchup() returns table(
  matchup_id uuid,matchup_number bigint,matchup_day date,starts_at timestamptz,ends_at timestamptz,
  song_a jsonb,song_b jsonb,song_a_votes int,song_b_votes int,total_votes int,selected_song_id text
) language sql stable security definer set search_path=public as $$
  select m.id,m.matchup_number,m.matchup_day,m.starts_at,m.ends_at,
    to_jsonb(a.*)||jsonb_build_object('providers',coalesce((select jsonb_agg(to_jsonb(p.*)) from song_providers p where p.song_id=a.id),'[]'::jsonb)),
    to_jsonb(b.*)||jsonb_build_object('providers',coalesce((select jsonb_agg(to_jsonb(p.*)) from song_providers p where p.song_id=b.id),'[]'::jsonb)),
    case when v.id is not null then m.song_a_votes end,case when v.id is not null then m.song_b_votes end,
    case when v.id is not null then m.song_a_votes+m.song_b_votes end,v.selected_song_id
  from daily_matchups m join songs a on a.id=m.song_a_id join songs b on b.id=m.song_b_id
  left join votes v on v.matchup_id=m.id and v.user_id=auth.uid()
  where now()>=m.starts_at and now()<m.ends_at and m.status in('scheduled','active')
    and a.status='active' and b.status='active'
    and exists(select 1 from song_providers where song_id=a.id and provider in('youtube','spotify','apple_music') and external_url is not null)
    and exists(select 1 from song_providers where song_id=b.id and provider in('youtube','spotify','apple_music') and external_url is not null) limit 1
$$;

create or replace function submit_daily_vote(p_matchup_id uuid,p_selected_song_id text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  u uuid:=auth.uid();m daily_matchups%rowtype;winner songs%rowtype;loser songs%rowtype;
  expected numeric;delta int;k int;vid uuid;day date;new_streak int;
begin
  if u is null then raise exception 'Authentication required';end if;
  select * into m from daily_matchups where id=p_matchup_id for update;
  if not found or now()<m.starts_at or now()>=m.ends_at or m.status not in('scheduled','active') then
    raise exception 'This matchup is not active';end if;
  if p_selected_song_id is null or p_selected_song_id not in(m.song_a_id,m.song_b_id) then
    raise exception 'Selected song is not in this matchup';end if;
  if exists(select 1 from votes where user_id=u and matchup_id=m.id) then raise exception 'You already voted in this matchup';end if;
  perform id from songs where id in(m.song_a_id,m.song_b_id) order by id for update;
  select * into winner from songs where id=p_selected_song_id;
  select * into loser from songs where id=case when p_selected_song_id=m.song_a_id then m.song_b_id else m.song_a_id end;
  if winner.status<>'active' or loser.status<>'active' then raise exception 'Both songs must be active';end if;
  if (select count(distinct song_id) from song_providers where song_id in(winner.id,loser.id)
    and provider in('youtube','spotify','apple_music') and external_url is not null)<>2 then
    raise exception 'Playback is unavailable for this matchup';end if;
  select elo_k_factor into k from app_settings where id=true;
  expected:=1/(1+power(10,(loser.elo_rating-winner.elo_rating)/400));delta:=round(k*(1-expected));
  update songs set elo_rating=elo_rating+delta,wins=wins+1,matchup_count=matchup_count+1,updated_at=now() where id=winner.id;
  update songs set elo_rating=elo_rating-delta,losses=losses+1,matchup_count=matchup_count+1,updated_at=now() where id=loser.id;
  update daily_matchups set song_a_votes=song_a_votes+(winner.id=m.song_a_id)::int,
    song_b_votes=song_b_votes+(winner.id=m.song_b_id)::int,status='active',updated_at=now() where id=m.id;
  insert into votes(user_id,matchup_id,song_a_id,song_b_id,selected_song_id,rejected_song_id,
    selected_rating_before,rejected_rating_before,selected_rating_after,rejected_rating_after,expected_score,rating_delta)
  values(u,m.id,m.song_a_id,m.song_b_id,winner.id,loser.id,winner.elo_rating,loser.elo_rating,
    winner.elo_rating+delta,loser.elo_rating-delta,expected,delta) returning id into vid;
  day:=m.matchup_day;insert into user_daily_activity(user_id,activity_day,vote_id) values(u,day,vid);
  select case when last_vote_day=day then current_streak when last_vote_day=day-1 then current_streak+1 else 1 end
    into new_streak from profiles where user_id=u for update;
  update profiles set last_vote_day=day,current_streak=new_streak,longest_streak=greatest(longest_streak,new_streak),
    total_votes=total_votes+1,updated_at=now() where user_id=u;
  insert into rating_events(vote_id,winner_song_id,loser_song_id,winner_before,loser_before,winner_after,loser_after,k_factor)
  values(vid,winner.id,loser.id,winner.elo_rating,loser.elo_rating,winner.elo_rating+delta,loser.elo_rating-delta,k);
  insert into song_rating_snapshots(song_id,rating,snapshot_date)
  select id,elo_rating,day from songs where id in(winner.id,loser.id)
  on conflict(song_id,snapshot_date) do update set rating=excluded.rating,created_at=now();
  return jsonb_build_object('voteId',vid,'ratingDelta',delta,'currentStreak',new_streak);
exception when unique_violation then raise exception 'You already voted in this matchup';end $$;

create function get_my_vote_history() returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(r order by r.created_at desc),'[]'::jsonb) from (
    select v.id,v.created_at,v.rating_delta,m.matchup_day,m.matchup_number,s.title,s.artist_name,s.genre,
      round(100.0*case when v.selected_song_id=m.song_a_id then m.song_a_votes else m.song_b_votes end
        /nullif(m.song_a_votes+m.song_b_votes,0)) as agreement
    from votes v join daily_matchups m on m.id=v.matchup_id join songs s on s.id=v.selected_song_id
    where v.user_id=auth.uid() order by v.created_at desc limit 50
  ) r
$$;
create function get_song_matchups(p_song_id text) returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(r order by r.matchup_day desc),'[]'::jsonb) from (
    select m.matchup_day,a.title as song_a_title,b.title as song_b_title,m.song_a_votes,m.song_b_votes
    from daily_matchups m join songs a on a.id=m.song_a_id join songs b on b.id=m.song_b_id
    where p_song_id in(m.song_a_id,m.song_b_id) and m.ends_at<=now() and m.status<>'cancelled'
    order by m.matchup_day desc limit 20
  ) r
$$;
revoke all on function submit_daily_vote(uuid,text),get_my_vote_history() from public,anon;
grant execute on function submit_daily_vote(uuid,text),get_my_vote_history() to authenticated;
grant execute on function get_today_matchup(),get_song_matchups(text) to anon,authenticated;
create view song_catalog with (security_invoker=true) as
with ranks as (select id,row_number() over(order by elo_rating desc,id) as global_rank from songs where status='active')
select s.*,r.global_rank,
  case when s.matchup_count>0 then round(100.0*s.wins/s.matchup_count,1) else 0 end as win_percentage,
  coalesce((select jsonb_agg(to_jsonb(p.*) order by p.provider) from song_providers p where p.song_id=s.id),'[]'::jsonb) as providers
from songs s left join ranks r on r.id=s.id;
grant select on song_catalog to anon,authenticated;

create function save_catalog(p_songs jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare s jsonb;p jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required';end if;
  if jsonb_typeof(p_songs)<>'array' or jsonb_array_length(p_songs) not between 1 and 100 then raise exception 'Import 1 to 100 songs at a time';end if;
  for s in select * from jsonb_array_elements(p_songs) loop
    insert into songs(id,title,normalized_title,artist_name,normalized_artist_name,album_name,release_year,genre,status)
    values(s->>'id',s->>'title',lower(s->>'title'),s->>'artistName',lower(s->>'artistName'),s->>'albumName',
      (s->>'releaseYear')::int,s->>'genre',(s->>'status')::song_status)
    on conflict(id) do update set title=excluded.title,normalized_title=excluded.normalized_title,
      artist_name=excluded.artist_name,normalized_artist_name=excluded.normalized_artist_name,album_name=excluded.album_name,
      release_year=excluded.release_year,genre=excluded.genre,status=excluded.status,updated_at=now();
    delete from song_providers where song_id=s->>'id';
    for p in select * from jsonb_array_elements(s->'providers') loop
      insert into song_providers(song_id,provider,provider_song_id,external_url)
      values(s->>'id',p->>'provider',p->>'providerSongId',p->>'externalUrl');
    end loop;
  end loop;
end $$;
revoke all on function save_catalog(jsonb) from public,anon;
grant execute on function save_catalog(jsonb) to authenticated;
commit;
