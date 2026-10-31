-- =========================================================================
-- Hello J — Games schema
-- The Marketplace Hub is three separate modules with their own tables,
-- their own RLS, and their own business logic — matching how Marketplace
-- (products/orders) already stands apart from everything else:
--
--   Marketplace (shopping)  -> products, orders                (already existed)
--   Games                   -> games, game_matches, game_players,
--                              game_invitations, game_moves, game_results,
--                              game_ratings, ai_configurations
--
-- Scope note: this migration lays down the full data model for the Games
-- module (multiplayer games, invitations, AI config, ratings/history) and
-- enough RLS/RPC to browse games, send an invitation, and see stats. It
-- deliberately does NOT implement the chess engine, AI move search, or an
-- authoritative move-validation RPC — "never trust the client to determine
-- ... whether a move is legal" means that has to be its own real piece of
-- work, not a stub bolted onto a schema migration. game_matches therefore
-- has no client UPDATE policy yet (see the comment on that policy below).
-- =========================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type match_mode as enum ('pvp', 'pvai', 'local');
create type match_status as enum ('waiting', 'active', 'completed', 'declined', 'expired', 'cancelled');
create type match_result as enum ('win', 'loss', 'draw', 'stalemate', 'resigned', 'timeout', 'abandoned');
create type ai_difficulty as enum ('easy', 'medium', 'hard');
create type game_invitation_status as enum ('pending', 'accepted', 'declined', 'expired', 'cancelled');

-- =========================================================================
-- GAMES MODULE
-- =========================================================================

-- The game catalog. New games are added as rows here, never as new code
-- paths in the tab bar — this is what lets Ludo/Checkers/Racing/etc. be
-- added later without touching the schema again.
create table public.games (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                 -- 'chess', 'ludo', 'tic_tac_toe', ...
  name text not null,
  description text,
  icon text,                                -- ionicon name or emoji, kept as free text
  min_players smallint not null default 2,
  max_players smallint not null default 2,
  supports_ai boolean not null default false,
  supports_multiplayer boolean not null default true,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Tunable search-depth/time budget per game+difficulty. The actual engine
-- reads this table when it lands; the schema doesn't interpret it.
create table public.ai_configurations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  difficulty ai_difficulty not null,
  max_search_depth smallint,
  max_time_ms integer,
  config jsonb not null default '{}'::jsonb,
  unique (game_id, difficulty)
);

create table public.game_matches (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  mode match_mode not null default 'pvp',
  status match_status not null default 'waiting',
  is_private boolean not null default true,
  ai_difficulty ai_difficulty,
  created_by uuid not null references public.profiles(id),
  current_turn_player_id uuid references public.profiles(id),
  board_state jsonb not null default '{}'::jsonb,
  result match_result,
  winner_id uuid references public.profiles(id),
  -- Secure, unguessable id for realtime channel names / deep links —
  -- separate from the primary key so the PK never has to be a secret.
  match_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.game_matches(id) on delete cascade,
  user_id uuid references public.profiles(id),   -- null for an AI seat
  is_ai boolean not null default false,
  ai_difficulty ai_difficulty,
  seat_index smallint not null,
  side text,                                     -- 'white'/'black', 'red'/'blue', etc.
  is_connected boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (match_id, seat_index),
  check (is_ai = true or user_id is not null)
);

create table public.game_invitations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  match_id uuid references public.game_matches(id),
  sender_id uuid not null references public.profiles(id),
  recipient_id uuid references public.profiles(id),
  recipient_email text,
  invitation_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status game_invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 days'),
  accepted_at timestamptz,
  declined_at timestamptz,
  check (recipient_id is not null or recipient_email is not null)
);

-- One row per move — the audit trail / replay source for match history,
-- reconnection and rematch. board_state on game_matches stays denormalised
-- for fast reads; this table is what reconstructs "how we got here".
create table public.game_moves (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.game_matches(id) on delete cascade,
  player_id uuid references public.profiles(id),
  move_number integer not null,
  move_data jsonb not null,
  board_state_after jsonb,
  created_at timestamptz not null default now(),
  unique (match_id, move_number)
);

create table public.game_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.game_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  result match_result not null,
  rating_delta integer not null default 0,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create table public.game_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  game_id uuid not null references public.games(id),
  rating integer not null default 1200,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, game_id)
);

-- "My Game Statistics" aggregated across every game, computed on read
-- rather than stored — cheap at this scale and always correct.
create view public.game_statistics_view as
select
  user_id,
  sum(games_played)::integer as games_played,
  sum(wins)::integer as wins,
  sum(losses)::integer as losses,
  sum(draws)::integer as draws,
  case when sum(games_played) > 0
    then round(sum(wins)::numeric / sum(games_played) * 100, 1)
    else 0
  end as win_percentage,
  (
    select gr2.game_id from public.game_ratings gr2
    where gr2.user_id = gr.user_id
    order by gr2.games_played desc, gr2.updated_at desc
    limit 1
  ) as favorite_game_id
from public.game_ratings gr
group by user_id;

create index game_matches_status_idx on public.game_matches (status);
create index game_matches_game_id_idx on public.game_matches (game_id);
create index game_players_match_id_idx on public.game_players (match_id);
create index game_players_user_id_idx on public.game_players (user_id);
create index game_invitations_recipient_idx on public.game_invitations (recipient_id, status);
create index game_invitations_sender_idx on public.game_invitations (sender_id, status);
create index game_invitations_token_idx on public.game_invitations (invitation_token);
create index game_moves_match_id_idx on public.game_moves (match_id);
create index game_ratings_game_rating_idx on public.game_ratings (game_id, rating desc);

create trigger game_matches_set_updated_at
  before update on public.game_matches
  for each row execute function public.set_updated_at();

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.games enable row level security;
alter table public.ai_configurations enable row level security;
alter table public.game_matches enable row level security;
alter table public.game_players enable row level security;
alter table public.game_invitations enable row level security;
alter table public.game_moves enable row level security;
alter table public.game_results enable row level security;
alter table public.game_ratings enable row level security;

-- ---- GAMES CATALOG ----
-- Readable by any signed-in user; writable only via service_role (admin
-- tooling / seed scripts) — there's deliberately no insert/update policy.
create policy "games are readable by authenticated users"
  on public.games for select using (auth.role() = 'authenticated');

create policy "ai configs are readable by authenticated users"
  on public.ai_configurations for select using (auth.role() = 'authenticated');

-- ---- GAME MATCHES ----
-- game_matches' policy needs to check game_players, and game_players'
-- policy needs to check game_matches — evaluated naively that's a direct
-- RLS cycle (each table's policy re-triggers the other's while Postgres
-- evaluates it), so the game_players lookup goes through this SECURITY
-- DEFINER helper instead: it bypasses RLS for its own internal query,
-- which is what breaks the cycle. It deliberately exposes nothing beyond
-- a boolean.
create or replace function public.is_match_participant(p_match_id uuid, p_user_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.game_players gp
    where gp.match_id = p_match_id and gp.user_id = p_user_id
  );
$$;

create policy "matches visible to participants or open lobbies"
  on public.game_matches for select
  using (
    is_private = false
    or created_by = auth.uid()
    or public.is_match_participant(id, auth.uid())
  );

create policy "users create their own matches"
  on public.game_matches for insert with check (created_by = auth.uid());

-- No UPDATE policy yet: board_state / status / winner_id must be mutated
-- through a server-side, move-validating RPC once the per-game engines
-- land, not by a direct client PATCH. Until that RPC exists, a match
-- simply can't be advanced past creation — which is correct: we don't
-- want gameplay state that *looks* authoritative but isn't.

-- ---- GAME PLAYERS ----
create policy "players visible to same-match participants"
  on public.game_players for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.game_matches gm
      where gm.id = game_players.match_id
        and (gm.is_private = false or gm.created_by = auth.uid())
    )
  );

create policy "users seat themselves"
  on public.game_players for insert with check (user_id = auth.uid() or is_ai = true);

-- ---- GAME INVITATIONS ----
create policy "invitations visible to sender or recipient"
  on public.game_invitations for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "users send invitations"
  on public.game_invitations for insert with check (sender_id = auth.uid());

-- Recipient may respond (pending -> accepted/declined); nothing else
-- about an invitation is client-mutable.
create policy "recipient responds to invitation"
  on public.game_invitations for update
  using (recipient_id = auth.uid() and status = 'pending')
  with check (status in ('accepted', 'declined'));

-- ---- GAME MOVES / RESULTS / RATINGS ----
create policy "moves visible to match participants"
  on public.game_moves for select
  using (public.is_match_participant(match_id, auth.uid()));
-- No INSERT policy: moves are written by the (future) move-validation
-- RPC via SECURITY DEFINER, never directly by the client.

create policy "results visible to the player they belong to"
  on public.game_results for select using (user_id = auth.uid());

-- Leaderboards need to read everyone's rating, so this one is public
-- (to any signed-in user).
create policy "ratings are readable by authenticated users"
  on public.game_ratings for select using (auth.role() = 'authenticated');

-- =========================================================================
-- RPCs
-- =========================================================================

-- Creates a match + a pending invitation in one transaction. The recipient
-- can be an existing Next Gen contact (recipient_id) or an email address
-- for someone who isn't on the app yet (recipient_email) — the "invite
-- someone who isn't on Next Gen" flow attaches to the same row and is
-- fulfilled later by an email-sending edge function, not by this RPC.
create or replace function public.create_game_invitation(
  p_game_key text,
  p_recipient_id uuid default null,
  p_recipient_email text default null
)
returns public.game_invitations
language plpgsql
security definer set search_path = public
as $$
declare
  v_game public.games;
  v_match public.game_matches;
  v_invitation public.game_invitations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_recipient_id is null and p_recipient_email is null then
    raise exception 'A recipient contact or email is required';
  end if;

  select * into v_game from public.games where key = p_game_key and is_active = true;
  if v_game.id is null then
    raise exception 'Unknown or inactive game: %', p_game_key;
  end if;

  insert into public.game_matches (game_id, mode, status, is_private, created_by)
  values (v_game.id, 'pvp', 'waiting', true, auth.uid())
  returning * into v_match;

  insert into public.game_players (match_id, user_id, seat_index, is_ai)
  values (v_match.id, auth.uid(), 0, false);

  insert into public.game_invitations (game_id, match_id, sender_id, recipient_id, recipient_email)
  values (v_game.id, v_match.id, auth.uid(), p_recipient_id, nullif(lower(p_recipient_email), ''))
  returning * into v_invitation;

  return v_invitation;
end;
$$;

-- =========================================================================
-- Seed the game catalog (safe to re-run)
-- =========================================================================
insert into public.games (key, name, description, icon, min_players, max_players, supports_ai, supports_multiplayer, sort_order)
values
  ('chess', 'Chess', 'The classic game of strategy — play a friend or the AI.', '♟️', 2, 2, true, true, 1),
  ('ludo', 'Ludo', 'Race your pieces home in this 2-4 player classic.', '🎲', 2, 4, true, true, 2),
  ('tic_tac_toe', 'Tic-Tac-Toe', 'Quick, casual, three-in-a-row.', '⭕', 2, 2, true, true, 3),
  ('connect_four', 'Connect Four', 'Drop and connect four in a row to win.', '🔴', 2, 2, true, true, 4),
  ('checkers', 'Checkers', 'Classic checkers, jump and capture your way to victory.', '🃏', 2, 2, true, true, 5),
  ('pool_8ball', '8-Ball Pool', 'Sink your balls before your opponent does.', '🎯', 2, 2, false, true, 6),
  ('racing', 'Racing', 'Race up to 4 players or against the AI.', '🏎️', 2, 4, true, true, 7),
  ('word_battle', 'Word Battle', 'Same letters, same clock — highest score wins.', '🧩', 2, 2, true, true, 8),
  ('snake_battle', 'Snake Battle', 'Multiplayer snake — last one slithering wins.', '🐍', 2, 4, true, true, 9)
on conflict (key) do nothing;