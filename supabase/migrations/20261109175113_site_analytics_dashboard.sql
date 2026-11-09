create schema if not exists analytics_private;
revoke all on schema analytics_private from public, anon, authenticated;
grant usage on schema analytics_private to service_role;

create table if not exists analytics_private.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists analytics_private.pageviews (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  page_path text not null check (char_length(page_path) between 1 and 180),
  referrer_host text,
  device_type text not null check (device_type in ('mobile','tablet','desktop','unknown')),
  created_at timestamptz not null default now()
);

create index if not exists site_pageviews_created_at_idx on analytics_private.pageviews (created_at desc);
create index if not exists site_pageviews_visitor_created_idx on analytics_private.pageviews (visitor_id, created_at desc);
create index if not exists site_pageviews_path_created_idx on analytics_private.pageviews (page_path, created_at desc);

revoke all on all tables in schema analytics_private from public, anon, authenticated;
grant select, insert on analytics_private.pageviews to service_role;
grant select on analytics_private.site_admins to service_role;

insert into analytics_private.site_admins (user_id)
values ('a0cf372c-5d93-4899-ab5d-1fb507387c06')
on conflict (user_id) do nothing;
