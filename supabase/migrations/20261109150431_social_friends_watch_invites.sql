-- Social layer for AniWatch: friend requests and persistent watch-party invitations.
-- Tables are intentionally restricted to authenticated users and protected by RLS.

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_not_self check (sender_id <> recipient_id)
);

create unique index if not exists friend_requests_active_pair_uidx
  on public.friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status in ('pending','accepted');
create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests (recipient_id, status, created_at desc);
create index if not exists friend_requests_sender_status_idx
  on public.friend_requests (sender_id, status, created_at desc);

alter table public.friend_requests enable row level security;
grant select, insert, delete on public.friend_requests to authenticated;
grant update (status, updated_at) on public.friend_requests to authenticated;

drop policy if exists "Users can read their own friend requests" on public.friend_requests;
create policy "Users can read their own friend requests"
  on public.friend_requests for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests"
  on public.friend_requests for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and recipient_id <> (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.profiles p where p.id = recipient_id)
  );

drop policy if exists "Recipients can respond to friend requests" on public.friend_requests;
create policy "Recipients can respond to friend requests"
  on public.friend_requests for update to authenticated
  using (recipient_id = (select auth.uid()) and status = 'pending')
  with check (recipient_id = (select auth.uid()) and status in ('accepted','declined'));

drop policy if exists "Users can remove their friend requests" on public.friend_requests;
create policy "Users can remove their friend requests"
  on public.friend_requests for delete to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

create table if not exists public.watch_party_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  room_code text not null check (room_code ~ '^[A-Z0-9]{6,12}$'),
  anime_id bigint not null check (anime_id > 0),
  episode integer not null default 1 check (episode > 0),
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint watch_party_invites_not_self check (inviter_id <> invitee_id)
);

create unique index if not exists watch_party_invites_pending_uidx
  on public.watch_party_invites (inviter_id, invitee_id, room_code)
  where status = 'pending';
create index if not exists watch_party_invites_invitee_idx
  on public.watch_party_invites (invitee_id, status, created_at desc);
create index if not exists watch_party_invites_inviter_idx
  on public.watch_party_invites (inviter_id, status, created_at desc);

alter table public.watch_party_invites enable row level security;
grant select, insert, delete on public.watch_party_invites to authenticated;
grant update (status, updated_at) on public.watch_party_invites to authenticated;

drop policy if exists "Users can read their own watch party invites" on public.watch_party_invites;
create policy "Users can read their own watch party invites"
  on public.watch_party_invites for select to authenticated
  using ((select auth.uid()) in (inviter_id, invitee_id));

drop policy if exists "Friends can invite each other to watch parties" on public.watch_party_invites;
create policy "Friends can invite each other to watch parties"
  on public.watch_party_invites for insert to authenticated
  with check (
    inviter_id = (select auth.uid())
    and invitee_id <> (select auth.uid())
    and status = 'pending'
    and expires_at > now()
    and exists (
      select 1 from public.friend_requests f
      where f.status = 'accepted'
        and (
          (f.sender_id = inviter_id and f.recipient_id = invitee_id)
          or (f.sender_id = invitee_id and f.recipient_id = inviter_id)
        )
    )
  );

drop policy if exists "Invitees can respond to watch party invites" on public.watch_party_invites;
create policy "Invitees can respond to watch party invites"
  on public.watch_party_invites for update to authenticated
  using (invitee_id = (select auth.uid()) and status = 'pending' and expires_at > now())
  with check (invitee_id = (select auth.uid()) and status in ('accepted','declined'));

drop policy if exists "Users can remove their own watch party invites" on public.watch_party_invites;
create policy "Users can remove their own watch party invites"
  on public.watch_party_invites for delete to authenticated
  using ((select auth.uid()) in (inviter_id, invitee_id));

-- Only non-sensitive public profile fields are discoverable by signed-in users.
grant select (id, username, avatar_url) on public.profiles to authenticated;
drop policy if exists "Authenticated users can discover profiles" on public.profiles;
create policy "Authenticated users can discover profiles"
  on public.profiles for select to authenticated using (true);

-- Enable database change events for live updates in the Together page.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_requests') then
      alter publication supabase_realtime add table public.friend_requests;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='watch_party_invites') then
      alter publication supabase_realtime add table public.watch_party_invites;
    end if;
  end if;
end $$;
