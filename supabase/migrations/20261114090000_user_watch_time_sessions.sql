-- Append-only, idempotent playback intervals. No historical time is backfilled.
create table if not exists public.user_watch_time_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  anime_id bigint not null check (anime_id > 0),
  watched_seconds integer not null check (watched_seconds between 1 and 30),
  watched_on date not null,
  created_at timestamptz not null default now(),
  constraint user_watch_time_sessions_pkey primary key (user_id, session_id)
);

create index if not exists user_watch_time_sessions_user_day_idx
  on public.user_watch_time_sessions (user_id, watched_on desc);

create index if not exists user_watch_time_sessions_user_anime_idx
  on public.user_watch_time_sessions (user_id, anime_id);

alter table public.user_watch_time_sessions enable row level security;

drop policy if exists "Users can read their own watch time" on public.user_watch_time_sessions;
create policy "Users can read their own watch time"
  on public.user_watch_time_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own watch time" on public.user_watch_time_sessions;
create policy "Users can insert their own watch time"
  on public.user_watch_time_sessions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on table public.user_watch_time_sessions from anon, public;
grant select, insert on table public.user_watch_time_sessions to authenticated;
