-- Tighten column-level grants for the social tables and public profile directory.
-- RLS remains the row boundary; these grants additionally prevent clients from
-- rewriting ownership, room codes, timestamps, or invite expiry.

revoke all privileges on table public.friend_requests from anon, authenticated;
grant select, delete on table public.friend_requests to authenticated;
grant insert (sender_id, recipient_id) on table public.friend_requests to authenticated;
grant update (status, updated_at) on table public.friend_requests to authenticated;

revoke all privileges on table public.watch_party_invites from anon, authenticated;
grant select, delete on table public.watch_party_invites to authenticated;
grant insert (inviter_id, invitee_id, room_code, anime_id, episode) on table public.watch_party_invites to authenticated;
grant update (status, updated_at) on table public.watch_party_invites to authenticated;

-- Only non-sensitive profile fields are available through the client API.
revoke all privileges on table public.profiles from anon, authenticated;
grant select (id, username, avatar_url) on table public.profiles to authenticated;
grant insert (id, username) on table public.profiles to authenticated;
grant update (username, avatar_url) on table public.profiles to authenticated;
