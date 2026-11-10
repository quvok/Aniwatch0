-- Store watched-episode state independently from user_library.history.
-- False rows are tombstones: keep them so unchecking a watched episode syncs across devices.

create table public.user_episode_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id bigint not null check (anime_id > 0),
  episode integer not null check (episode > 0),
  is_watched boolean not null default true,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint user_episode_progress_pkey primary key (user_id, anime_id, episode)
);

alter table public.user_episode_progress enable row level security;

create policy "Read own episode progress"
  on public.user_episode_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Insert own episode progress"
  on public.user_episode_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Update own episode progress"
  on public.user_episode_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.user_episode_progress from public, anon;
grant select, insert, update on table public.user_episode_progress to authenticated;

create or replace function public.set_user_episode_progress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;

revoke all on function public.set_user_episode_progress_updated_at() from public, anon, authenticated;

create trigger user_episode_progress_updated_at
before update on public.user_episode_progress
for each row execute function public.set_user_episode_progress_updated_at();

-- Backfill without deleting or rewriting the legacy user_library rows.
insert into public.user_episode_progress (user_id, anime_id, episode, is_watched)
select distinct ul.user_id, ul.anime_id, episode_value::integer, true
from public.user_library as ul
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(ul.history->'watchedEpisodes') = 'array'
      then ul.history->'watchedEpisodes'
    else '[]'::jsonb
  end
) as episodes(episode_value)
where episode_value ~ '^[0-9]{1,10}$'
  and episode_value::numeric between 1 and 2147483647
on conflict (user_id, anime_id, episode) do nothing;

do $publication$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_episode_progress'
  ) then
    alter publication supabase_realtime add table public.user_episode_progress;
  end if;
end;
$publication$;
