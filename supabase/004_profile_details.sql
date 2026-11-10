-- AniWatch profile editor fields.
-- Existing profiles RLS policies remain in place; no policy is widened here.
alter table public.profiles
  add column if not exists bio text not null default '',
  add column if not exists banner_url text;

alter table public.profiles
  drop constraint if exists profiles_bio_length_check;
alter table public.profiles
  add constraint profiles_bio_length_check check (char_length(bio) <= 280);

grant select (id, username, avatar_url, bio, banner_url, created_at)
  on public.profiles to authenticated;
grant update (username, avatar_url, bio, banner_url)
  on public.profiles to authenticated;
