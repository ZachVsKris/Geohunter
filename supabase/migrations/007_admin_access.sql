-- GeoStats Migration 007
-- Creates the private admin allowlist used to protect /admin.
-- Before running, replace PASTE_YOUR_AUTH_USER_UUID_HERE with your UUID
-- from Supabase Authentication > Users.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

drop policy if exists "Admins can verify their own access" on public.app_admins;

create policy "Admins can verify their own access"
on public.app_admins
for select
to authenticated
using (auth.uid() = user_id);

-- Client applications cannot add, change, or remove administrators.
-- Those actions must be performed in the Supabase SQL Editor or by a
-- trusted server using a secret/service-role key.

insert into public.app_admins (user_id)
values ('PASTE_YOUR_AUTH_USER_UUID_HERE'::uuid)
on conflict (user_id) do nothing;
