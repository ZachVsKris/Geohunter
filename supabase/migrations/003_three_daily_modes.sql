-- GeoStats three-Daily migration: preserve the former Normal data and add a new Easy mode.
-- Run once in Supabase SQL Editor after 002_dual_daily_modes.sql.

begin;

alter table public.daily_challenges
  drop constraint if exists daily_challenges_difficulty_check;
alter table public.daily_scores
  drop constraint if exists daily_scores_difficulty_check;

-- The composite foreign key does not cascade updates, so recreate it around the rename.
alter table public.daily_scores
  drop constraint if exists daily_scores_challenge_date_difficulty_fkey;

-- In v11.2 and earlier, the database value "easy" represented the player-facing Normal mode.
update public.daily_challenges set difficulty = 'normal' where difficulty = 'easy';
update public.daily_scores set difficulty = 'normal' where difficulty = 'easy';

alter table public.daily_scores
  add constraint daily_scores_challenge_date_difficulty_fkey
  foreign key (challenge_date, difficulty)
  references public.daily_challenges(challenge_date, difficulty)
  on delete cascade;

alter table public.daily_challenges alter column difficulty set default 'normal';
alter table public.daily_scores alter column difficulty set default 'normal';

alter table public.daily_challenges
  add constraint daily_challenges_difficulty_check
  check (difficulty in ('easy','normal','expert'));
alter table public.daily_scores
  add constraint daily_scores_difficulty_check
  check (difficulty in ('easy','normal','expert'));

commit;
