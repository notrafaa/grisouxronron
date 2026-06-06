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

create table if not exists public.duel_lobbies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) = 6),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished', 'aborted')),
  winner_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  ends_at timestamptz,
  current_track text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.duel_players (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.duel_lobbies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  score integer not null default 0 check (score >= 0),
  hp double precision not null default 100 check (hp >= 0 and hp <= 100),
  status text not null default 'online' check (status in ('online', 'disconnected', 'left')),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (lobby_id, user_id)
);

create table if not exists public.duel_events (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.duel_lobbies(id) on delete cascade,
  type text not null check (type in ('phrase', 'target', 'spam', 'hold', 'bait')),
  prompt text not null,
  payload jsonb not null default '{}'::jsonb,
  points integer not null default 10,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.duel_lobbies enable row level security;
alter table public.duel_players enable row level security;
alter table public.duel_events enable row level security;

drop policy if exists "Authenticated players read lobbies" on public.duel_lobbies;
create policy "Authenticated players read lobbies"
  on public.duel_lobbies
  for select
  to authenticated
  using (true);

drop policy if exists "Players create owned lobbies" on public.duel_lobbies;
create policy "Players create owned lobbies"
  on public.duel_lobbies
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Lobby participants update lobbies" on public.duel_lobbies;
create policy "Lobby participants update lobbies"
  on public.duel_lobbies
  for update
  to authenticated
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.duel_players
      where duel_players.lobby_id = duel_lobbies.id
      and duel_players.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    or exists (
      select 1 from public.duel_players
      where duel_players.lobby_id = duel_lobbies.id
      and duel_players.user_id = auth.uid()
    )
  );

drop policy if exists "Authenticated players read duel players" on public.duel_players;
create policy "Authenticated players read duel players"
  on public.duel_players
  for select
  to authenticated
  using (true);

drop policy if exists "Players join as themselves" on public.duel_players;
create policy "Players join as themselves"
  on public.duel_players
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Players update duel rows" on public.duel_players;
create policy "Players update duel rows"
  on public.duel_players
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.duel_players as me
      where me.lobby_id = duel_players.lobby_id
      and me.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.duel_players as me
      where me.lobby_id = duel_players.lobby_id
      and me.user_id = auth.uid()
    )
  );

drop policy if exists "Players leave own duel row" on public.duel_players;
create policy "Players leave own duel row"
  on public.duel_players
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated players read duel events" on public.duel_events;
create policy "Authenticated players read duel events"
  on public.duel_events
  for select
  to authenticated
  using (true);

drop policy if exists "Lobby participants create duel events" on public.duel_events;
create policy "Lobby participants create duel events"
  on public.duel_events
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.duel_players
      where duel_players.lobby_id = duel_events.lobby_id
      and duel_players.user_id = auth.uid()
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'duel_lobbies'
  ) then
    alter publication supabase_realtime add table public.duel_lobbies;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'duel_players'
  ) then
    alter publication supabase_realtime add table public.duel_players;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'duel_events'
  ) then
    alter publication supabase_realtime add table public.duel_events;
  end if;
end $$;
