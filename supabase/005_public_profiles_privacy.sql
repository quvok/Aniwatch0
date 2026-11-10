-- Public AniWatch profiles with explicit privacy controls.
alter table public.profiles
  add column if not exists profile_visibility text not null default 'friends',
  add column if not exists show_stats boolean not null default true,
  add column if not exists show_favorites boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_profile_visibility_check;
alter table public.profiles
  add constraint profiles_profile_visibility_check
  check (profile_visibility in ('public','friends','private'));

grant select (profile_visibility, show_stats, show_favorites)
  on public.profiles to authenticated;
grant update (profile_visibility, show_stats, show_favorites)
  on public.profiles to authenticated;

create or replace function public.get_public_profile(target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  viewer uuid := auth.uid();
  target public.profiles%rowtype;
  allowed boolean := false;
  stats jsonb := null;
  favorites jsonb := '[]'::jsonb;
begin
  if viewer is null or target_user is null then
    return null;
  end if;

  select * into target
  from public.profiles
  where id = target_user;

  if not found then
    return null;
  end if;

  if viewer = target_user then
    allowed := true;
  elsif target.profile_visibility = 'public' then
    allowed := true;
  elsif target.profile_visibility = 'friends' then
    select exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.sender_id = viewer and fr.recipient_id = target_user)
          or (fr.sender_id = target_user and fr.recipient_id = viewer))
    ) into allowed;
  end if;

  if not allowed then
    return null;
  end if;

  if target.show_stats or viewer = target_user then
    select jsonb_build_object(
      'total', count(*),
      'watching', count(*) filter (where status = 'watching'),
      'planned', count(*) filter (where status = 'planned'),
      'completed', count(*) filter (where status = 'completed'),
      'dropped', count(*) filter (where status = 'dropped'),
      'favorites', count(*) filter (where is_favorite),
      'rated', count(rating),
      'average_rating', round(avg(rating), 1)
    ) into stats
    from public.user_library
    where user_id = target_user;
  end if;

  if target.show_favorites or viewer = target_user then
    select coalesce(jsonb_agg(anime_id order by updated_at desc), '[]'::jsonb)
      into favorites
    from (
      select anime_id, updated_at
      from public.user_library
      where user_id = target_user and is_favorite = true
      order by updated_at desc
      limit 12
    ) f;
  end if;

  return jsonb_build_object(
    'id', target.id,
    'username', target.username,
    'avatar_url', target.avatar_url,
    'banner_url', target.banner_url,
    'bio', target.bio,
    'created_at', target.created_at,
    'profile_visibility', target.profile_visibility,
    'show_stats', case when viewer = target_user then target.show_stats else null end,
    'show_favorites', case when viewer = target_user then target.show_favorites else null end,
    'stats', stats,
    'favorite_ids', case when target.show_favorites or viewer = target_user then favorites else null end,
    'is_owner', viewer = target_user
  );
end;
$$;

revoke all on function public.get_public_profile(uuid) from public;
revoke all on function public.get_public_profile(uuid) from anon;
grant execute on function public.get_public_profile(uuid) to authenticated;
