create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

create table if not exists public.calendar_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  shikimori_id bigint not null check (shikimori_id > 0),
  notify_before boolean not null default true,
  notify_release boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, shikimori_id)
);
alter table public.calendar_follows enable row level security;
drop policy if exists "Read own calendar follows" on public.calendar_follows;
create policy "Read own calendar follows" on public.calendar_follows
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own calendar follows" on public.calendar_follows;
create policy "Insert own calendar follows" on public.calendar_follows
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own calendar follows" on public.calendar_follows;
create policy "Update own calendar follows" on public.calendar_follows
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own calendar follows" on public.calendar_follows;
create policy "Delete own calendar follows" on public.calendar_follows
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.calendar_follows from anon;
grant select, insert, update, delete on table public.calendar_follows to authenticated, service_role;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (length(endpoint) between 20 and 4096),
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Read own push subscriptions" on public.push_subscriptions;
create policy "Read own push subscriptions" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own push subscriptions" on public.push_subscriptions;
create policy "Insert own push subscriptions" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own push subscriptions" on public.push_subscriptions;
create policy "Update own push subscriptions" on public.push_subscriptions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own push subscriptions" on public.push_subscriptions;
create policy "Delete own push subscriptions" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.push_subscriptions from anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated, service_role;

create table if not exists public.calendar_push_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  shikimori_id bigint not null check (shikimori_id > 0),
  episode integer not null check (episode > 0),
  event_type text not null check (event_type in ('before', 'release')),
  scheduled_at timestamptz not null,
  delivered_at timestamptz not null default now(),
  primary key (user_id, shikimori_id, episode, event_type)
);
alter table public.calendar_push_deliveries enable row level security;
revoke all on table public.calendar_push_deliveries from anon, authenticated;
grant select, insert, update, delete on table public.calendar_push_deliveries to service_role;

create or replace function public.get_calendar_push_config()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(secret.name, secret.decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets as secret
  where secret.name in ('aniwatch_calendar_cron_token', 'aniwatch_calendar_vapid_private_key')
$$;
revoke all on function public.get_calendar_push_config() from public, anon, authenticated;
grant execute on function public.get_calendar_push_config() to service_role;
