-- Count only qualified visits from the new tracker; preserve legacy rows for audit.
alter table analytics_private.pageviews
  add column if not exists qualified_at timestamptz;

drop index if exists analytics_private.site_pageviews_visitor_path_minute_idx;

create index if not exists site_pageviews_qualified_at_idx
  on analytics_private.pageviews (qualified_at desc)
  where qualified_at is not null;

create or replace function public.record_site_pageview(
  p_visitor_id uuid, p_page_path text, p_referrer_host text, p_device_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_visitor_id is null or p_page_path is null
     or char_length(p_page_path) < 1 or char_length(p_page_path) > 180
     or left(p_page_path, 1) <> '/'
     or position('?' in p_page_path) > 0 or position('#' in p_page_path) > 0
     or p_device_type not in ('mobile', 'tablet', 'desktop', 'unknown') then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_visitor_id::text, 0)
  );

  if (select count(*) from analytics_private.pageviews
      where visitor_id = p_visitor_id
        and qualified_at >= now() - interval '1 minute') >= 20 then
    return false;
  end if;

  if exists (
    select 1 from analytics_private.pageviews
    where visitor_id = p_visitor_id
      and page_path = p_page_path
      and qualified_at >= now() - interval '30 minutes'
  ) then
    return false;
  end if;

  insert into analytics_private.pageviews (
    visitor_id, page_path, referrer_host, device_type, qualified_at
  ) values (
    p_visitor_id, p_page_path,
    nullif(left(coalesce(p_referrer_host, ''), 120), ''),
    p_device_type, now()
  );
  return true;
end;
$$;

revoke all on function public.record_site_pageview(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_site_pageview(uuid, text, text, text)
  to service_role;

create or replace function public.site_analytics_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select now() as now_at
  ),
  last_30 as (
    select p.* from analytics_private.pageviews p, bounds b
    where p.qualified_at is not null
      and p.qualified_at >= b.now_at - interval '30 days'
  ),
  daily as (
    select to_char(day_bucket, 'YYYY-MM-DD') as day,
      count(p.id)::bigint as views,
      count(distinct p.visitor_id)::bigint as visitors
    from generate_series(date_trunc('day', now()) - interval '29 days',
      date_trunc('day', now()), interval '1 day') as day_bucket
    left join last_30 p on p.qualified_at >= day_bucket
      and p.qualified_at < day_bucket + interval '1 day'
    group by day_bucket order by day_bucket
  ),
  top_pages as (
    select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', views)), '[]'::jsonb) as value
    from (select page_path as path, count(*)::bigint as views from last_30
      group by page_path order by views desc limit 10) q
  ),
  devices as (
    select coalesce(jsonb_agg(jsonb_build_object('device', device, 'views', views)), '[]'::jsonb) as value
    from (select device_type as device, count(*)::bigint as views from last_30
      group by device_type order by views desc) q
  ),
  referrers as (
    select coalesce(jsonb_agg(jsonb_build_object('host', host, 'views', views)), '[]'::jsonb) as value
    from (select coalesce(nullif(referrer_host, ''), 'Прямой переход') as host, count(*)::bigint as views
      from last_30 group by coalesce(nullif(referrer_host, ''), 'Прямой переход')
      order by views desc limit 10) q
  )
  select jsonb_build_object(
    'total_views', (select count(*)::bigint from analytics_private.pageviews where qualified_at is not null),
    'total_visitors', (select count(distinct visitor_id)::bigint from analytics_private.pageviews where qualified_at is not null),
    'views_24h', (select count(*)::bigint from analytics_private.pageviews p, bounds b where p.qualified_at >= b.now_at - interval '24 hours'),
    'visitors_24h', (select count(distinct visitor_id)::bigint from analytics_private.pageviews p, bounds b where p.qualified_at >= b.now_at - interval '24 hours'),
    'views_7d', (select count(*)::bigint from analytics_private.pageviews p, bounds b where p.qualified_at >= b.now_at - interval '7 days'),
    'visitors_7d', (select count(distinct visitor_id)::bigint from analytics_private.pageviews p, bounds b where p.qualified_at >= b.now_at - interval '7 days'),
    'views_30d', (select count(*)::bigint from last_30),
    'visitors_30d', (select count(distinct visitor_id)::bigint from last_30),
    'active_5m', (select count(distinct visitor_id)::bigint from analytics_private.pageviews p, bounds b where p.qualified_at >= b.now_at - interval '5 minutes'),
    'daily', (select coalesce(jsonb_agg(to_jsonb(daily)), '[]'::jsonb) from daily),
    'top_pages', (select value from top_pages),
    'devices', (select value from devices),
    'referrers', (select value from referrers),
    'updated_at', now()
  );
$$;
