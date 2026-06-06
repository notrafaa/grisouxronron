create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 18),
  selected_cat text not null default 'grisou' check (selected_cat in ('grisou', 'ronron')),
  treats double precision not null default 0 check (treats >= 0),
  total_clicks bigint not null default 0 check (total_clicks >= 0),
  click_power double precision not null default 1 check (click_power >= 1),
  auto_rate double precision not null default 0 check (auto_rate >= 0),
  multiplier double precision not null default 1 check (multiplier >= 1),
  upgrades jsonb not null default '{"paw":0,"cushion":0,"gloss":0,"snack":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_unique_lower
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "Leaderboard is public" on public.profiles;
create policy "Leaderboard is public"
  on public.profiles
  for select
  using (true);

drop policy if exists "Players create own profile" on public.profiles;
create policy "Players create own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Players update own profile" on public.profiles;
create policy "Players update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Players delete own profile" on public.profiles;
create policy "Players delete own profile"
  on public.profiles
  for delete
  using (auth.uid() = id);
