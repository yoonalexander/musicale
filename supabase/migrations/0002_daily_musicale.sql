-- Preserve historical data privately while replacing the old product and APIs.
begin;
create schema musicale_legacy;
revoke all on schema musicale_legacy from public, anon, authenticated;
drop function public.submit_rank_vote(text,text,text);
drop trigger on_auth_user_created on auth.users;
alter table public.votes set schema musicale_legacy;
alter table public.game_runs set schema musicale_legacy;
alter table public.daily_vote_usage set schema musicale_legacy;
alter table public.songs set schema musicale_legacy;
alter table public.profiles set schema musicale_legacy;
revoke all on all tables in schema musicale_legacy from public, anon, authenticated;
alter type public.song_status set schema musicale_legacy;
alter type public.song_category set schema musicale_legacy;
create extension if not exists pgcrypto;
do $$ begin
  create type public.user_role as enum ('user','admin'); exception when duplicate_object then null; end $$;
do $$ begin
  create type public.song_status as enum ('active','unavailable','disabled'); exception when duplicate_object then null; end $$;
do $$ begin
  create type public.matchup_status as enum ('scheduled','active','complete','cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60), role public.user_role not null default 'user',
  last_vote_day date, current_streak integer not null default 0 check(current_streak>=0),
  longest_streak integer not null default 0 check(longest_streak>=0), total_votes integer not null default 0 check(total_votes>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.profiles(user_id,display_name,role,created_at)
select user_id,left(display_name,60),role,created_at from musicale_legacy.profiles;
insert into public.profiles(user_id,display_name)
select id,left(split_part(coalesce(email,'listener'),'@',1),60) from auth.users on conflict do nothing;
create table if not exists public.songs (
  id text primary key, title text not null, normalized_title text not null, artist_name text not null,
  normalized_artist_name text not null, album_name text, release_date date, release_year integer check(release_year between 1860 and 2200),
  artwork_url text, duration_ms integer check(duration_ms>0), genre text, status public.song_status not null default 'active',
  elo_rating numeric(10,2) not null default 1500, wins integer not null default 0, losses integer not null default 0,
  matchup_count integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.song_providers (
  id uuid primary key default gen_random_uuid(), song_id text not null references public.songs(id) on delete cascade,
  provider text not null check(provider in ('youtube','spotify','apple_music','musicbrainz')),
  provider_song_id text not null, embed_url text, external_url text, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(provider,provider_song_id)
);
create table if not exists public.daily_matchups (
  id uuid primary key default gen_random_uuid(), matchup_number bigint generated always as identity unique,
  matchup_day date not null unique, song_a_id text not null references public.songs(id), song_b_id text not null references public.songs(id),
  starts_at timestamptz not null, ends_at timestamptz not null, status public.matchup_status not null default 'scheduled',
  selection_strategy text not null default 'editorial', created_by uuid references auth.users(id),
  song_a_votes integer not null default 0, song_b_votes integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(song_a_id<>song_b_id), check(starts_at<ends_at)
);
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  matchup_id uuid not null references public.daily_matchups(id) on delete cascade,
  song_a_id text not null references public.songs(id), song_b_id text not null references public.songs(id),
  selected_song_id text not null references public.songs(id), rejected_song_id text not null references public.songs(id),
  selected_rating_before numeric(10,2) not null, rejected_rating_before numeric(10,2) not null,
  selected_rating_after numeric(10,2) not null, rejected_rating_after numeric(10,2) not null,
  expected_score numeric not null, rating_delta integer not null, created_at timestamptz not null default now(), unique(user_id,matchup_id)
);
create table if not exists public.rating_events (
  id uuid primary key default gen_random_uuid(), vote_id uuid not null unique references public.votes(id) on delete cascade,
  winner_song_id text not null references public.songs(id), loser_song_id text not null references public.songs(id),
  winner_before numeric not null, loser_before numeric not null, winner_after numeric not null, loser_after numeric not null,
  k_factor integer not null, created_at timestamptz not null default now()
);
create table if not exists public.user_daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade, activity_day date not null,
  vote_id uuid not null unique references public.votes(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id,activity_day)
);
create table if not exists public.song_rating_snapshots (
  id uuid primary key default gen_random_uuid(), song_id text not null references public.songs(id) on delete cascade,
  rating numeric not null, rank integer, snapshot_date date not null, created_at timestamptz not null default now(), unique(song_id,snapshot_date)
);
create index if not exists songs_leaderboard_idx on public.songs(status,elo_rating desc);
create index if not exists votes_user_created_idx on public.votes(user_id,created_at desc);
create index if not exists votes_matchup_idx on public.votes(matchup_id);
create index if not exists matchups_active_idx on public.daily_matchups(starts_at,ends_at,status);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into public.profiles(user_id,display_name) values(new.id,left(split_part(coalesce(new.email,'listener'),'@',1),60)) on conflict do nothing;return new;end$$;
drop trigger if exists on_auth_user_created on auth.users;create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create or replace function public.is_admin(check_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where user_id=check_user and role='admin')$$;

alter table public.profiles enable row level security;alter table public.songs enable row level security;alter table public.song_providers enable row level security;
alter table public.daily_matchups enable row level security;alter table public.votes enable row level security;alter table public.rating_events enable row level security;
alter table public.user_daily_activity enable row level security;alter table public.song_rating_snapshots enable row level security;
create policy "public read songs" on public.songs for select using(true);create policy "public read providers" on public.song_providers for select using(true);
create policy "public read matchups" on public.daily_matchups for select using(true);create policy "public read snapshots" on public.song_rating_snapshots for select using(true);
create policy "own profile read" on public.profiles for select using(auth.uid()=user_id or public.is_admin());
create policy "own profile update" on public.profiles for update using(auth.uid()=user_id) with check(auth.uid()=user_id and role=(select role from profiles where user_id=auth.uid()));
create policy "own votes read" on public.votes for select using(auth.uid()=user_id or public.is_admin());
create policy "own activity read" on public.user_daily_activity for select using(auth.uid()=user_id or public.is_admin());
create policy "admin songs" on public.songs for all using(public.is_admin()) with check(public.is_admin());
create policy "admin providers" on public.song_providers for all using(public.is_admin()) with check(public.is_admin());
create policy "admin matchups" on public.daily_matchups for all using(public.is_admin()) with check(public.is_admin());
create policy "admin events" on public.rating_events for select using(public.is_admin());

create or replace function public.get_today_matchup() returns table(matchup_id uuid,matchup_number bigint,matchup_day date,starts_at timestamptz,ends_at timestamptz,song_a jsonb,song_b jsonb,song_a_votes int,song_b_votes int,total_votes int)
language sql stable security definer set search_path=public as $$
 select m.id,m.matchup_number,m.matchup_day,m.starts_at,m.ends_at,to_jsonb(a.*)||jsonb_build_object('youtube_video_id',ya.provider_song_id,'external_url',ya.external_url),to_jsonb(b.*)||jsonb_build_object('youtube_video_id',yb.provider_song_id,'external_url',yb.external_url),m.song_a_votes,m.song_b_votes,m.song_a_votes+m.song_b_votes
 from daily_matchups m join songs a on a.id=m.song_a_id join songs b on b.id=m.song_b_id
 left join lateral(select provider_song_id,external_url from song_providers where song_id=a.id and provider='youtube' limit 1) ya on true
 left join lateral(select provider_song_id,external_url from song_providers where song_id=b.id and provider='youtube' limit 1) yb on true
 where now()>=m.starts_at and now()<m.ends_at and m.status in('scheduled','active') limit 1$$;

create or replace function public.submit_daily_vote(p_matchup_id uuid,p_selected_song_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid();m daily_matchups%rowtype;winner songs%rowtype;loser songs%rowtype;expected numeric;delta int;k int:=24;vid uuid;day date;new_streak int;
begin
 if u is null then raise exception 'Authentication required';end if;
 select * into m from daily_matchups where id=p_matchup_id for update;
 if not found or now()<m.starts_at or now()>=m.ends_at or m.status not in('scheduled','active') then raise exception 'This matchup is not active';end if;
 if p_selected_song_id not in(m.song_a_id,m.song_b_id) then raise exception 'Selected song is not in this matchup';end if;
 if exists(select 1 from votes where user_id=u and matchup_id=m.id) then raise exception 'You already voted in this matchup';end if;
 select * into winner from songs where id=p_selected_song_id for update;
 select * into loser from songs where id=case when p_selected_song_id=m.song_a_id then m.song_b_id else m.song_a_id end for update;
 expected:=1/(1+power(10,(loser.elo_rating-winner.elo_rating)/400));delta:=round(k*(1-expected));
 update songs set elo_rating=elo_rating+delta,wins=wins+1,matchup_count=matchup_count+1,updated_at=now() where id=winner.id;
 update songs set elo_rating=elo_rating-delta,losses=losses+1,matchup_count=matchup_count+1,updated_at=now() where id=loser.id;
 update daily_matchups set song_a_votes=song_a_votes+(winner.id=m.song_a_id)::int,song_b_votes=song_b_votes+(winner.id=m.song_b_id)::int,status='active',updated_at=now() where id=m.id;
 insert into votes(user_id,matchup_id,song_a_id,song_b_id,selected_song_id,rejected_song_id,selected_rating_before,rejected_rating_before,selected_rating_after,rejected_rating_after,expected_score,rating_delta)
 values(u,m.id,m.song_a_id,m.song_b_id,winner.id,loser.id,winner.elo_rating,loser.elo_rating,winner.elo_rating+delta,loser.elo_rating-delta,expected,delta) returning id into vid;
 day:=m.matchup_day;insert into user_daily_activity(user_id,activity_day,vote_id) values(u,day,vid);
 select case when last_vote_day=day then current_streak when last_vote_day=day-1 then current_streak+1 else 1 end into new_streak from profiles where user_id=u for update;
 update profiles set last_vote_day=day,current_streak=new_streak,longest_streak=greatest(longest_streak,new_streak),total_votes=total_votes+1,updated_at=now() where user_id=u;
 insert into rating_events(vote_id,winner_song_id,loser_song_id,winner_before,loser_before,winner_after,loser_after,k_factor) values(vid,winner.id,loser.id,winner.elo_rating,loser.elo_rating,winner.elo_rating+delta,loser.elo_rating-delta,k);
 return jsonb_build_object('voteId',vid,'ratingDelta',delta);
exception when unique_violation then raise exception 'You already voted in this matchup';end$$;
revoke all on function public.submit_daily_vote(uuid,text) from public;grant execute on function public.submit_daily_vote(uuid,text) to authenticated;
commit;
