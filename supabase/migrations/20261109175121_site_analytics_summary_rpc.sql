create or replace function public.site_analytics_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select now() as now_at, date_trunc('day', now()) as today_at
  ),
  last_30 as (
    select p.* from analytics_private.pageviews p, bounds b
    where p.created_at >= b.now_at - interval '30 days'
  ),
  daily as (
    select to_char(day_bucket, 'YYYY-MM-DD') as day,
      count(p.id)::bigint as views,
      count(distinct p.visitor_id)::bigint as visitors
    from generate_series(date_trunc('day', now()) - interval '29 days',
      date_trunc('day', now()), interval '1 day') as day_bucket
    left join last_30 p on p.created_at >= day_bucket
      and p.created_at < day_bucket + interval '1 day'
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
    'total_views', (select count(*)::bigint from analytics_private.pageviews),
    'total_visitors', (select count(distinct visitor_id)::bigint from analytics_private.pageviews),
    'views_24h', (select count(*)::bigint from analytics_private.pageviews p, bounds b where p.created_at >= b.now_at - interval '24 hours'),
    'visitors_24h', (select count(distinct visitor_id)::bigint from analytics_private.pageviews p, bounds b where p.created_at >= b.now_at - interval '24 hours'),
    'views_7d', (select count(*)::bigint from analytics_private.pageviews p, bounds b where p.created_at >= b.now_at - interval '7 days'),
    'visitors_7d', (select count(distinct visitor_id)::bigint from analytics_private.pageviews p, bounds b where p.created_at >= b.now_at - interval '7 days'),
    'views_30d', (select count(*)::bigint from last_30),
    'visitors_30d', (select count(distinct visitor_id)::bigint from last_30),
    'active_5m', (select count(distinct visitor_id)::bigint from analytics_private.pageviews p, bounds b where p.created_at >= b.now_at - interval '5 minutes'),
    'daily', (select coalesce(jsonb_agg(to_jsonb(daily)), '[]'::jsonb) from daily),
    'top_pages', (select value from top_pages),
    'devices', (select value from devices),
    'referrers', (select value from referrers),
    'updated_at', now()
  );
$$;
revoke all on function public.site_analytics_summary() from public, anon, authenticated;
grant execute on function public.site_analytics_summary() to service_role;
