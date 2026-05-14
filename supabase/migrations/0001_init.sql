-- Pintintín initial schema
-- Users are owned by Supabase Auth (auth.users)

create table if not exists profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  display_name   text unique not null,
  avatar_url     text,
  play_balance   bigint not null default 10000,
  created_at     timestamptz default now()
);

create table if not exists tables_log (
  id             uuid primary key default gen_random_uuid(),
  stake_level    int not null,
  variant        text not null default 'ffa4',
  created_at     timestamptz default now(),
  ended_at       timestamptz
);

create table if not exists matches (
  id             uuid primary key default gen_random_uuid(),
  table_id       uuid not null references tables_log(id),
  target_score   int not null,
  winner_user_id uuid references profiles(user_id),
  started_at     timestamptz default now(),
  ended_at       timestamptz
);

create table if not exists match_players (
  match_id       uuid references matches(id) on delete cascade,
  user_id        uuid references profiles(user_id),
  seat           int not null check (seat between 0 and 3),
  final_score    int not null default 0,
  primary key (match_id, user_id)
);

create table if not exists rounds (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references matches(id) on delete cascade,
  round_no       int not null,
  starter_seat   int not null,
  winner_seat    int,
  end_reason     text,
  scores_json    jsonb not null,
  hand_log_json  jsonb not null,
  created_at     timestamptz default now()
);

create table if not exists ledger (
  id             bigserial primary key,
  user_id        uuid not null references profiles(user_id),
  delta          bigint not null,
  reason         text not null,
  ref_match_id   uuid references matches(id),
  ref_round_id   uuid references rounds(id),
  created_at     timestamptz default now()
);

create index if not exists rounds_match_round_idx on rounds (match_id, round_no);
create index if not exists ledger_user_created_idx on ledger (user_id, created_at desc);
create index if not exists match_players_user_idx on match_players (user_id);

alter table profiles enable row level security;
alter table ledger enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table rounds enable row level security;

create policy "profiles_self_read" on profiles for select using (true);
create policy "profiles_self_update" on profiles for update using (auth.uid() = user_id);

create policy "ledger_owner_read" on ledger for select using (auth.uid() = user_id);

create policy "matches_participant_read" on matches for select
  using (exists (select 1 from match_players mp where mp.match_id = matches.id and mp.user_id = auth.uid()));

create policy "rounds_participant_read" on rounds for select
  using (exists (select 1 from match_players mp where mp.match_id = rounds.match_id and mp.user_id = auth.uid()));

create policy "match_players_participant_read" on match_players for select
  using (user_id = auth.uid()
         or exists (select 1 from match_players mp2 where mp2.match_id = match_players.match_id and mp2.user_id = auth.uid()));
