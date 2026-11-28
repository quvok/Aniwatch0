create table if not exists public.user_interface_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null check (locale in ('ru', 'es-419'))
);
alter table public.user_interface_preferences enable row level security;
revoke all on public.user_interface_preferences from anon, authenticated;
grant select, insert, update on public.user_interface_preferences to authenticated;
create policy "Users read their interface preferences"
  on public.user_interface_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their interface preferences"
  on public.user_interface_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update their interface preferences"
  on public.user_interface_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.chat_translation_quota (
  bucket text primary key,
  revision timestamptz not null,
  hits integer not null
);
alter table public.chat_translation_quota enable row level security;
revoke all on public.chat_translation_quota from public, anon, authenticated;

create function public.take_chat_translation_slot(p_user uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  current_minute timestamptz := pg_catalog.date_trunc('minute', pg_catalog.now());
  used integer;
begin
  insert into public.chat_translation_quota as quota (bucket, revision, hits)
  values (p_user::text, current_minute, 1)
  on conflict (bucket) do update set
    hits = case when quota.revision = current_minute then quota.hits + 1 else 1 end,
    revision = current_minute
  where quota.revision <> current_minute or quota.hits < 15
  returning hits into used;
  if not found then return false; end if;

  insert into public.chat_translation_quota as quota (bucket, revision, hits)
  values ('global', current_minute, 1)
  on conflict (bucket) do update set
    hits = case when quota.revision = current_minute then quota.hits + 1 else 1 end,
    revision = current_minute
  where quota.revision <> current_minute or quota.hits < 120
  returning hits into used;
  return found;
end;
$$;
revoke all on function public.take_chat_translation_slot(uuid) from public, anon, authenticated;
grant execute on function public.take_chat_translation_slot(uuid) to service_role;
