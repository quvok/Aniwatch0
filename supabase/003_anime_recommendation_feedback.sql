create table if not exists public.anime_recommendation_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id bigint not null check (anime_id > 0),
  action text not null default 'not_interested' check (action in ('not_interested')),
  created_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);

alter table public.anime_recommendation_feedback enable row level security;

drop policy if exists "Read own recommendation feedback" on public.anime_recommendation_feedback;
create policy "Read own recommendation feedback"
  on public.anime_recommendation_feedback
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Insert own recommendation feedback" on public.anime_recommendation_feedback;
create policy "Insert own recommendation feedback"
  on public.anime_recommendation_feedback
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Update own recommendation feedback" on public.anime_recommendation_feedback;
create policy "Update own recommendation feedback"
  on public.anime_recommendation_feedback
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Delete own recommendation feedback" on public.anime_recommendation_feedback;
create policy "Delete own recommendation feedback"
  on public.anime_recommendation_feedback
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.anime_recommendation_feedback from anon;
grant select, insert, update, delete on table public.anime_recommendation_feedback to authenticated;
