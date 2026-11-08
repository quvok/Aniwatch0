-- AniWatch: allow a signed-in user to create only their own profile row.
-- Run once in Supabase SQL Editor.
create policy "Insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);
