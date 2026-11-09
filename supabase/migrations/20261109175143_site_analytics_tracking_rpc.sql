create or replace function public.record_site_pageview(
  p_visitor_id uuid, p_page_path text, p_referrer_host text, p_device_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_recent_count integer;
begin
  if p_visitor_id is null or p_page_path is null
     or char_length(p_page_path) < 1 or char_length(p_page_path) > 180
     or left(p_page_path, 1) <> '/'
     or position('?' in p_page_path) > 0 or position('#' in p_page_path) > 0
     or p_device_type not in ('mobile', 'tablet', 'desktop', 'unknown') then
    return false;
  end if;
  select count(*) into v_recent_count from analytics_private.pageviews
  where visitor_id = p_visitor_id and created_at >= now() - interval '1 minute';
  if v_recent_count >= 20 then return false; end if;
  if exists (select 1 from analytics_private.pageviews
    where visitor_id = p_visitor_id and page_path = p_page_path
      and created_at >= now() - interval '30 seconds') then return false; end if;
  insert into analytics_private.pageviews(visitor_id, page_path, referrer_host, device_type)
  values (p_visitor_id, p_page_path, nullif(left(coalesce(p_referrer_host, ''), 120), ''), p_device_type);
  return true;
end;
$$;
revoke all on function public.record_site_pageview(uuid, text, text, text) from public;
grant execute on function public.record_site_pageview(uuid, text, text, text) to anon, authenticated, service_role;
