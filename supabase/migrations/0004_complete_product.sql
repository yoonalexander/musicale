begin;
alter table daily_matchups add column featured boolean not null default false;
create index votes_user_history on votes(user_id,created_at desc,id);
create index songs_catalog_filters on songs(status,genre,release_year,artist_name);

-- Request budgets persist across application instances. No IP addresses are stored.
create table request_budgets(user_id uuid references auth.users(id) on delete cascade,
  action text check(action in('vote','admin','profile','analytics')),window_start timestamptz,
  attempts int not null,primary key(user_id,action,window_start));
alter table request_budgets enable row level security;
revoke all on request_budgets from public,anon,authenticated;
create function reserve_request(p_action text) returns boolean language plpgsql security definer set search_path=public as $$
declare n int;budget int;u uuid:=auth.uid();
begin
  if u is null then raise exception 'Authentication required';end if;
  budget:=case p_action when 'vote' then 10 when 'admin' then 30 when 'profile' then 5 when 'analytics' then 30 end;
  if budget is null then raise exception 'Invalid request category';end if;
  if p_action='admin' and not is_admin() then raise exception 'Admin access required';end if;
  delete from request_budgets where window_start<now()-interval '7 days';
  insert into request_budgets values(u,p_action,date_trunc('minute',now()),1)
  on conflict(user_id,action,window_start) do update set attempts=least(request_budgets.attempts+1,10000)
  returning attempts into n;
  return n<=budget;
end $$;
revoke all on function reserve_request(text) from public,anon;
grant execute on function reserve_request(text) to authenticated;

-- The original transactional function is callable only through this durable request wrapper.
alter function submit_daily_vote(uuid,text) rename to process_daily_vote;
revoke all on function process_daily_vote(uuid,text) from public,anon,authenticated;
create function submit_daily_vote(p_matchup_id uuid,p_selected_song_id text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not reserve_request('vote') then return jsonb_build_object('error','Too many vote attempts. Try again next minute.');end if;
  -- A failed vote rolls back its subtransaction, while the request budget commits.
  begin
    result:=process_daily_vote(p_matchup_id,p_selected_song_id);
  exception when others then
    return jsonb_build_object('error',case when SQLERRM in('Authentication required','This matchup is not active',
      'Selected song is not in this matchup','You already voted in this matchup','Both songs must be active',
      'Playback is unavailable for this matchup') then SQLERRM else 'Could not record your vote. Please try again.' end);
  end;
  return result;
end $$;
revoke all on function submit_daily_vote(uuid,text) from public,anon;
grant execute on function submit_daily_vote(uuid,text) to authenticated;

create function update_my_display_name(p_name text) returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required';end if;
  if char_length(trim(p_name)) not between 1 and 80 or p_name ~ '[[:cntrl:]]' then raise exception 'Use a name of 1 to 80 characters';end if;
  update profiles set display_name=trim(p_name),updated_at=now() where user_id=auth.uid();
end $$;
revoke all on function update_my_display_name(text) from public,anon;
grant execute on function update_my_display_name(text) to authenticated;

create function get_my_profile_data(p_offset int default 0) returns jsonb language sql stable security definer set search_path=public as $$
with history as (
  select v.id,v.created_at,v.rating_delta,v.selected_song_id,m.matchup_day,m.matchup_number,s.title,s.artist_name,s.genre,
    case when v.selected_song_id=m.song_a_id then m.song_a_votes else m.song_b_votes end as agreed,
    m.song_a_votes+m.song_b_votes as participants,m.ends_at<=now() as finished
  from votes v join daily_matchups m on m.id=v.matchup_id join songs s on s.id=v.selected_song_id where v.user_id=auth.uid()
), finished as(select * from history where finished and participants>=5),
artists as(select artist_name as label,count(*) as count from history group by artist_name having count(*)>=3 order by count(*) desc,artist_name limit 3),
genres as(select genre as label,count(*) as count from history where genre is not null group by genre having count(*)>=3 order by count(*) desc,genre limit 3),
picks as(select selected_song_id as song_id,title,artist_name,count(*) as count from history group by selected_song_id,title,artist_name having count(*)>=2 order by count(*) desc,title limit 3)
select jsonb_build_object('total',(select count(*) from history),
 'history',coalesce((select jsonb_agg(r order by r.created_at desc,r.id) from
   (select *,round(100.0*agreed/nullif(participants,0)) as agreement from history order by created_at desc,id limit 25 offset greatest(0,least(p_offset,250000))) r),'[]'::jsonb),
 'stats',jsonb_build_object('sample',(select count(*) from finished),
   'majority',coalesce((select round(100.0*count(*) filter(where agreed*2>participants)/nullif(count(*),0)) from finished),0),
   'artists',coalesce((select jsonb_agg(artists) from artists),'[]'::jsonb),
   'genres',coalesce((select jsonb_agg(genres) from genres),'[]'::jsonb),
   'picks',coalesce((select jsonb_agg(picks) from picks),'[]'::jsonb),
   'controversial',coalesce((select jsonb_agg(r) from
     (select title,artist_name,matchup_day,round(100.0*agreed/participants) as agreement from finished where agreed*4<participants order by 1.0*agreed/participants,matchup_day desc limit 3) r),'[]'::jsonb)))
$$;
revoke all on function get_my_profile_data(int) from public,anon;
grant execute on function get_my_profile_data(int) to authenticated;

create or replace view song_catalog with (security_invoker=true) as
with ranks as(select id,row_number() over(order by elo_rating desc,id) as global_rank from songs where status='active')
select s.*,r.global_rank,
 case when s.matchup_count>0 then round(100.0*s.wins/s.matchup_count,1) else 0 end as win_percentage,
 coalesce((select jsonb_agg(to_jsonb(p.*) order by p.provider) from song_providers p where p.song_id=s.id),'[]'::jsonb) as providers,
 s.elo_rating-coalesce((select rating from song_rating_snapshots h where h.song_id=s.id and h.snapshot_date<(now() at time zone 'UTC')::date-6 order by h.snapshot_date desc limit 1),1500) as recent_movement
from songs s left join ranks r on r.id=s.id;

create or replace function save_catalog(p_songs jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare s jsonb;p jsonb;
begin
 if not is_admin() then raise exception 'Admin access required';end if;
 if jsonb_typeof(p_songs)<>'array' or jsonb_array_length(p_songs) not between 1 and 100 then raise exception 'Import 1 to 100 songs at a time';end if;
 for s in select * from jsonb_array_elements(p_songs) loop
  insert into songs(id,title,normalized_title,artist_name,normalized_artist_name,album_name,release_year,genre,status,release_date,duration_ms,artwork_url)
  values(s->>'id',s->>'title',lower(s->>'title'),s->>'artistName',lower(s->>'artistName'),s->>'albumName',(s->>'releaseYear')::int,s->>'genre',(s->>'status')::song_status,
    nullif(s->>'releaseDate','')::date,nullif(s->>'durationMs','')::int,nullif(s->>'artworkUrl',''))
  on conflict(id) do update set title=excluded.title,normalized_title=excluded.normalized_title,artist_name=excluded.artist_name,
    normalized_artist_name=excluded.normalized_artist_name,album_name=excluded.album_name,release_year=excluded.release_year,
    genre=excluded.genre,status=excluded.status,release_date=excluded.release_date,duration_ms=excluded.duration_ms,artwork_url=excluded.artwork_url,updated_at=now();
  delete from song_providers where song_id=s->>'id';
  for p in select * from jsonb_array_elements(s->'providers') loop
   insert into song_providers(song_id,provider,provider_song_id,external_url) values(s->>'id',p->>'provider',p->>'providerSongId',p->>'externalUrl');
  end loop;
 end loop;
end $$;
alter table songs add constraint valid_duration check(duration_ms is null or duration_ms between 1000 and 86400000);
alter table songs add constraint consistent_release_date check(release_date is null or extract(year from release_date)=release_year);
alter table songs add constraint https_artwork check(artwork_url is null or artwork_url ~ '^https://[^/@[:space:]]+(/|$)');

-- Aggregate opt-in analytics: only named events and UTC-day counts, no payloads or identifiers.
create table product_event_counts(event_day date,event text check(event in('landing_view','sign_in_started','daily_view','preview_started','vote_submitted','share_copied','leaderboard_view','streak_continued')),count bigint not null default 0,primary key(event_day,event));
alter table product_event_counts enable row level security;
revoke all on product_event_counts from public,anon,authenticated;
grant select on product_event_counts to authenticated;
create policy admin_product_events on product_event_counts for select using(is_admin());
create function record_product_event(p_event text) returns void language plpgsql security definer set search_path=public as $$
begin
 if p_event not in('landing_view','sign_in_started','daily_view','preview_started','vote_submitted','share_copied','leaderboard_view','streak_continued') then raise exception 'Invalid event';end if;
 if not reserve_request('analytics') then return;end if;
 delete from product_event_counts where event_day<(now() at time zone 'UTC')::date-90;
 insert into product_event_counts values((now() at time zone 'UTC')::date,p_event,1)
 on conflict(event_day,event) do update set count=product_event_counts.count+1;
end $$;
revoke all on function record_product_event(text) from public,anon;
grant execute on function record_product_event(text) to authenticated;

create function get_admin_overview() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'Admin access required';end if;
 return jsonb_build_object('accounts',(select count(*) from profiles),'votes',(select count(*) from votes),
  'todayVotes',(select coalesce(sum(song_a_votes+song_b_votes),0) from daily_matchups where matchup_day=(now() at time zone 'UTC')::date),
  'daily',coalesce((select jsonb_agg(r) from(select matchup_day,song_a_votes+song_b_votes as votes,status from daily_matchups order by matchup_day desc limit 30) r),'[]'::jsonb),
  'suspicious',coalesce((select jsonb_agg(r) from(select user_id,sum(attempts) as attempts,count(*) filter(where attempts>10) as limited_minutes from request_budgets where action='vote' and window_start>now()-interval '24 hours' group by user_id having sum(attempts)>20 order by sum(attempts) desc limit 25) r),'[]'::jsonb));
end $$;
revoke all on function get_admin_overview() from public,anon;
grant execute on function get_admin_overview() to authenticated;

-- Restore derived state from immutable recorded changes, preserving historical K factors.
create function rebuild_rankings() returns integer language plpgsql security definer set search_path=public as $$
declare n int;
begin
 if not is_admin() then raise exception 'Admin access required';end if;
 lock table daily_matchups,songs,votes,rating_events in exclusive mode;
 if exists(select 1 from votes v left join rating_events e on e.vote_id=v.id where e.id is null)
   or exists(select 1 from rating_events e join votes v on v.id=e.vote_id where e.winner_song_id<>v.selected_song_id or e.loser_song_id<>v.rejected_song_id
     or e.winner_after-e.winner_before<>v.rating_delta or e.loser_before-e.loser_after<>v.rating_delta) then
   raise exception 'Audit records are inconsistent. No rankings changed';end if;
 with changes as(select winner_song_id as song_id,winner_after-winner_before as delta,1 as win,0 as loss from rating_events
   union all select loser_song_id,loser_after-loser_before,0,1 from rating_events),
 totals as(select song_id,sum(delta) as delta,sum(win) as wins,sum(loss) as losses from changes group by song_id)
 update songs s set elo_rating=1500+coalesce(t.delta,0),wins=coalesce(t.wins,0),losses=coalesce(t.losses,0),
   matchup_count=coalesce(t.wins,0)+coalesce(t.losses,0),updated_at=now() from
   (select s.id,t.* from songs s left join totals t on t.song_id=s.id) t where s.id=t.id;
 update daily_matchups m set song_a_votes=(select count(*) from votes v where v.matchup_id=m.id and v.selected_song_id=m.song_a_id),
   song_b_votes=(select count(*) from votes v where v.matchup_id=m.id and v.selected_song_id=m.song_b_id) where m.id is not null;
 delete from song_rating_snapshots where song_id is not null;
 with changes as(select e.winner_song_id as song_id,m.matchup_day as day,e.winner_after-e.winner_before as delta from rating_events e join votes v on v.id=e.vote_id join daily_matchups m on m.id=v.matchup_id
   union all select e.loser_song_id,m.matchup_day,e.loser_after-e.loser_before from rating_events e join votes v on v.id=e.vote_id join daily_matchups m on m.id=v.matchup_id),
 days as(select song_id,day,sum(delta) as delta from changes group by song_id,day)
 insert into song_rating_snapshots(song_id,snapshot_date,rating)
 select song_id,day,1500+sum(delta) over(partition by song_id order by day) from days;
 select count(*) into n from rating_events;
 insert into admin_audit_log(actor_id,entity,entity_id,operation,after_value) values(auth.uid(),'rankings','global','REBUILD',jsonb_build_object('events',n));
 return n;
end $$;
revoke all on function rebuild_rankings() from public,anon;
grant execute on function rebuild_rankings() to authenticated;

create function get_featured_matchups() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(r order by r.matchup_day desc),'[]'::jsonb) from
 (select m.matchup_day,m.matchup_number,a.id as song_a_id,a.title as song_a_title,b.id as song_b_id,b.title as song_b_title,m.song_a_votes,m.song_b_votes
  from daily_matchups m join songs a on a.id=m.song_a_id join songs b on b.id=m.song_b_id
  where m.featured and m.ends_at<=now() and m.status<>'cancelled' order by m.matchup_day desc limit 50) r
$$;
revoke all on function get_featured_matchups() from public;
grant execute on function get_featured_matchups() to anon,authenticated;
commit;
