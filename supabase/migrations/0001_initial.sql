create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'song_category') then
    create type public.song_category as enum ('broadway', 'movie');
  end if;

  if not exists (select 1 from pg_type where typname = 'song_status') then
    create type public.song_status as enum ('active', 'inactive');
  end if;

  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('user', 'admin');
  end if;
end $$;

create table if not exists public.songs (
  id text primary key,
  title text not null,
  musical_title text not null,
  category public.song_category not null,
  artist_label text not null,
  artwork_url text,
  youtube_url text,
  status public.song_status not null default 'active',
  release_year integer not null check (release_year >= 1900),
  tags text[] not null default '{}',
  elo_rating numeric(10,2) not null default 1200,
  vote_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  left_song_id text not null references public.songs(id),
  right_song_id text not null references public.songs(id),
  winner_song_id text not null references public.songs(id),
  loser_song_id text not null references public.songs(id),
  rating_delta_winner integer not null,
  rating_delta_loser integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.game_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score >= 0),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  seed_context text
);

create table if not exists public.daily_vote_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  count integer not null default 0,
  primary key (user_id, usage_date)
);

create index if not exists songs_ranking_idx on public.songs (status, elo_rating desc, vote_count asc);
create index if not exists songs_category_idx on public.songs (category, elo_rating desc);
create index if not exists game_runs_score_idx on public.game_runs (score desc, ended_at asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists songs_set_updated_at on public.songs;
create trigger songs_set_updated_at
before update on public.songs
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, split_part(coalesce(new.email, 'player@musicale.app'), '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = check_user
      and role = 'admin'
  );
$$;

alter table public.songs enable row level security;
alter table public.profiles enable row level security;
alter table public.votes enable row level security;
alter table public.game_runs enable row level security;
alter table public.daily_vote_usage enable row level security;

create policy "songs are readable"
on public.songs
for select
using (true);

create policy "admins manage songs"
on public.songs
for all
using (public.is_admin())
with check (public.is_admin());

create policy "profiles are readable"
on public.profiles
for select
using (true);

create policy "users manage own profile"
on public.profiles
for update
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy "admins read votes"
on public.votes
for select
using (public.is_admin());

create policy "authenticated create game runs"
on public.game_runs
for insert
with check (auth.uid() = user_id);

create policy "game runs are readable"
on public.game_runs
for select
using (true);

create policy "users read own vote usage"
on public.daily_vote_usage
for select
using (auth.uid() = user_id or public.is_admin());

create or replace function public.submit_rank_vote(
  p_left_song_id text,
  p_right_song_id text,
  p_winner_song_id text
)
returns table (
  winner_song_id text,
  loser_song_id text,
  winner_rating numeric,
  loser_rating numeric,
  votes_used integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_loser_song_id text;
  v_winner_rating numeric(10,2);
  v_loser_rating numeric(10,2);
  v_expected_winner numeric;
  v_expected_loser numeric;
  v_winner_delta integer;
  v_loser_delta integer;
  v_vote_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_winner_song_id not in (p_left_song_id, p_right_song_id) then
    raise exception 'Winner must be one of the presented songs.';
  end if;

  v_loser_song_id := case
    when p_winner_song_id = p_left_song_id then p_right_song_id
    else p_left_song_id
  end;

  insert into public.daily_vote_usage (user_id, usage_date, count)
  values (v_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set count = public.daily_vote_usage.count + 1
  returning count into v_vote_count;

  if v_vote_count > 50 then
    update public.daily_vote_usage
    set count = count - 1
    where user_id = v_user_id
      and usage_date = current_date;
    raise exception 'Daily vote limit reached.';
  end if;

  select elo_rating into v_winner_rating
  from public.songs
  where id = p_winner_song_id
    and status = 'active'
  for update;

  select elo_rating into v_loser_rating
  from public.songs
  where id = v_loser_song_id
    and status = 'active'
  for update;

  if v_winner_rating is null or v_loser_rating is null then
    raise exception 'Both songs must be active.';
  end if;

  v_expected_winner := 1 / (1 + power(10, (v_loser_rating - v_winner_rating) / 400));
  v_expected_loser := 1 / (1 + power(10, (v_winner_rating - v_loser_rating) / 400));
  v_winner_delta := round(24 * (1 - v_expected_winner));
  v_loser_delta := round(24 * (0 - v_expected_loser));
  v_winner_rating := v_winner_rating + v_winner_delta;
  v_loser_rating := v_loser_rating + v_loser_delta;

  update public.songs
  set
    elo_rating = v_winner_rating,
    vote_count = vote_count + 1
  where id = p_winner_song_id;

  update public.songs
  set
    elo_rating = v_loser_rating,
    vote_count = vote_count + 1
  where id = v_loser_song_id;

  insert into public.votes (
    user_id,
    left_song_id,
    right_song_id,
    winner_song_id,
    loser_song_id,
    rating_delta_winner,
    rating_delta_loser
  )
  values (
    v_user_id,
    p_left_song_id,
    p_right_song_id,
    p_winner_song_id,
    v_loser_song_id,
    v_winner_delta,
    v_loser_delta
  );

  return query
  select
    p_winner_song_id,
    v_loser_song_id,
    v_winner_rating,
    v_loser_rating,
    v_vote_count;
end;
$$;
