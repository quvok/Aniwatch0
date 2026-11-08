-- Username is the account's stable login identifier.
create unique index if not exists profiles_username_unique
on public.profiles (lower(username))
where username is not null
  and btrim(username) <> ''
  and lower(username) not in ('аноним', 'гость');

-- Only the login Edge Function's service role can resolve a username to an email.
create or replace function public.lookup_auth_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(btrim(p_username))
    and lower(p.username) not in ('аноним', 'гость')
  limit 1;
$$;

revoke all on function public.lookup_auth_email_by_username(text) from public, anon, authenticated;
grant execute on function public.lookup_auth_email_by_username(text) to service_role;
