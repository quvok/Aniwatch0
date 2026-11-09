create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('friend_request','friend_accepted','watch_invite')),
  entity_id uuid,
  title text not null,
  body text not null default '',
  href text not null default '/together.html',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (recipient_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications" on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
drop policy if exists "Users can mark their notifications read" on public.notifications;
create policy "Users can mark their notifications read" on public.notifications for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

create or replace function public.notify_social_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_table_name = 'friend_requests' then
    if tg_op = 'INSERT' and new.status = 'pending' then
      insert into public.notifications(recipient_id, actor_id, type, entity_id, title, body)
      values (new.recipient_id, new.sender_id, 'friend_request', new.id, 'Новая заявка в друзья', 'Пользователь хочет добавить тебя в друзья');
    elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
      insert into public.notifications(recipient_id, actor_id, type, entity_id, title, body)
      values (new.sender_id, new.recipient_id, 'friend_accepted', new.id, 'Заявка принята', 'Теперь вы друзья');
    end if;
  elsif tg_table_name = 'watch_party_invites' and tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications(recipient_id, actor_id, type, entity_id, title, body)
    values (new.invitee_id, new.inviter_id, 'watch_invite', new.id, 'Приглашение на совместный просмотр', 'Тебя пригласили смотреть аниме вместе');
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_social_event() from public, anon, authenticated;
drop trigger if exists friend_request_notification on public.friend_requests;
create trigger friend_request_notification after insert or update of status on public.friend_requests for each row execute function public.notify_social_event();
drop trigger if exists watch_invite_notification on public.watch_party_invites;
create trigger watch_invite_notification after insert on public.watch_party_invites for each row execute function public.notify_social_event();
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;