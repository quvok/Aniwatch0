revoke all on table public.notifications from public, anon;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
