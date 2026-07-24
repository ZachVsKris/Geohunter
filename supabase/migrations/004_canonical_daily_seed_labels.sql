-- GeoStats seed-label cleanup.
-- Run once after 003 if the Supabase table shows two DAILY-EASY seed labels.
-- This changes only the readable seed text; boards and scores are untouched.

begin;

update public.daily_challenges
set seed = 'DAILY-' || upper(difficulty) || '-' || challenge_date::text
where difficulty in ('easy','normal','expert')
  and seed is distinct from ('DAILY-' || upper(difficulty) || '-' || challenge_date::text);

commit;
