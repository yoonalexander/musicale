insert into public.songs(id,title,normalized_title,artist_name,normalized_artist_name,album_name,release_year,genre) values
('respect-aretha','Respect','respect','Aretha Franklin','aretha franklin','I Never Loved a Man the Way I Love You',1967,'Soul'),
('god-only-knows','God Only Knows','god only knows','The Beach Boys','the beach boys','Pet Sounds',1966,'Pop'),
('dreams-fleetwood-mac','Dreams','dreams','Fleetwood Mac','fleetwood mac','Rumours',1977,'Rock'),
('superstition-stevie-wonder','Superstition','superstition','Stevie Wonder','stevie wonder','Talking Book',1972,'Funk'),
('fast-car-tracy-chapman','Fast Car','fast car','Tracy Chapman','tracy chapman','Tracy Chapman',1988,'Folk Rock'),
('juicy-notorious-big','Juicy','juicy','The Notorious B.I.G.','the notorious big','Ready to Die',1994,'Hip-Hop'),
('crazy-in-love-beyonce','Crazy in Love','crazy in love','Beyoncé','beyonce','Dangerously in Love',2003,'R&B'),
('paper-planes-mia','Paper Planes','paper planes','M.I.A.','mia','Kala',2007,'Alternative'),
('alright-kendrick-lamar','Alright','alright','Kendrick Lamar','kendrick lamar','To Pimp a Butterfly',2015,'Hip-Hop'),
('bad-guy-billie-eilish','bad guy','bad guy','Billie Eilish','billie eilish','When We All Fall Asleep, Where Do We Go?',2019,'Pop') on conflict(id) do nothing;
-- Official uploads verified 2026-10-01; external links avoid embedding/cookie assumptions.
insert into public.song_providers(song_id,provider,provider_song_id,external_url) values
('respect-aretha','youtube','JzqGZjFnYnA','https://www.youtube.com/watch?v=JzqGZjFnYnA'),
('god-only-knows','youtube','NADx3-qRxek','https://www.youtube.com/watch?v=NADx3-qRxek')
on conflict(provider,provider_song_id) do nothing;
insert into public.daily_matchups(matchup_day,song_a_id,song_b_id,starts_at,ends_at,status,selection_strategy)
select (now() at time zone 'UTC')::date,'respect-aretha','god-only-knows',
  date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',
  (date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC','scheduled','editorial'
on conflict(matchup_day) do nothing;
