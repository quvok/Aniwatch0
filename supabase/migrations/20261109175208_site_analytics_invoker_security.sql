create unique index if not exists site_pageviews_visitor_path_minute_idx
  on analytics_private.pageviews (
    visitor_id, page_path, (date_trunc('minute', created_at at time zone 'UTC'))
  );

alter table analytics_private.pageviews enable row level security;
drop policy if exists site_pageviews_insert_event on analytics_private.pageviews;
create policy site_pageviews_insert_event on analytics_private.pageviews
  for insert to anon, authenticated with check (true);
grant usage on schema analytics_private to anon, authenticated;
grant insert on analytics_private.pageviews to anon, authenticated;

alter table analytics_private.site_admins enable row level security;
drop policy if exists site_admins_read_own on analytics_private.site_admins;
create policy site_admins_read_own on analytics_private.site_admins
  for select to authenticated using (user_id = (select auth.uid()));
grant select on analytics_private.site_admins to authenticated;

create or replace function public.is_site_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists (select 1 from analytics_private.site_admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;

create or replace function public.record_site_pageview(
  p_visitor_id uuid, p_page_path text, p_referrer_host text, p_device_type text
)
returns boolean language plpgsql security invoker set search_path = ''
as $$
begin
  if p_visitor_id is null or p_page_path is null
     or char_length(p_page_path) < 1 or char_length(p_page_path) > 180
     or left(p_page_path, 1) <> '/'
     or position('?' in p_page_path) > 0 or position('#' in p_page_path) > 0
     or p_device_type not in ('mobile', 'tablet', 'desktop', 'unknown') then
    return false;
  end if;
  insert into analytics_private.pageviews(visitor_id, page_path, referrer_host, device_type)
  values (p_visitor_id, p_page_path, nullif(left(coalesce(p_referrer_host, ''), 120), ''), p_device_type)
  on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.record_site_pageview(uuid, text, text, text) from public;
grant execute on function public.record_site_pageview(uuid, text, text, text) to anon, authenticated, service_role;
