-- The function remains attached to the auth.users insert trigger.
-- It is not a public API operation and must not be callable through PostgREST RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
