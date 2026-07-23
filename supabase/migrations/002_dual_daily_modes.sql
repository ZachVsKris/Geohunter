-- GeoStats dual Daily migration: Normal + Expert boards and separate score records.
-- Run once in Supabase SQL Editor after 001_geostats.sql.

begin;

alter table public.daily_challenges
  add column if not exists difficulty text not null default 'easy';

alter table public.daily_scores
  add column if not exists difficulty text not null default 'easy';

alter table public.daily_challenges
  drop constraint if exists daily_challenges_difficulty_check;
alter table public.daily_challenges
  add constraint daily_challenges_difficulty_check check (difficulty in ('easy','expert'));

alter table public.daily_scores
  drop constraint if exists daily_scores_difficulty_check;
alter table public.daily_scores
  add constraint daily_scores_difficulty_check check (difficulty in ('easy','expert'));

alter table public.daily_scores
  drop constraint if exists daily_scores_challenge_date_fkey;
alter table public.daily_scores
  drop constraint if exists daily_scores_user_id_challenge_date_key;
alter table public.daily_scores
  drop constraint if exists daily_scores_challenge_date_difficulty_fkey;
alter table public.daily_scores
  drop constraint if exists daily_scores_user_date_difficulty_key;
alter table public.daily_challenges
  drop constraint if exists daily_challenges_pkey;

alter table public.daily_challenges
  add constraint daily_challenges_pkey primary key (challenge_date, difficulty);

alter table public.daily_scores
  add constraint daily_scores_challenge_date_difficulty_fkey
  foreign key (challenge_date, difficulty)
  references public.daily_challenges(challenge_date, difficulty)
  on delete cascade;

alter table public.daily_scores
  add constraint daily_scores_user_date_difficulty_key
  unique (user_id, challenge_date, difficulty);

create index if not exists daily_challenges_date_difficulty_idx
  on public.daily_challenges(challenge_date, difficulty);
create index if not exists daily_scores_date_difficulty_score_idx
  on public.daily_scores(challenge_date, difficulty, score desc);

commit;
