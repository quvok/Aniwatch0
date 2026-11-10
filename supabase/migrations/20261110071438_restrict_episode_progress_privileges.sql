-- Do not allow physical deletes; unwatching is represented by is_watched = false.
revoke all on table public.user_episode_progress from public, anon, authenticated;
grant select, insert, update on table public.user_episode_progress to authenticated;
