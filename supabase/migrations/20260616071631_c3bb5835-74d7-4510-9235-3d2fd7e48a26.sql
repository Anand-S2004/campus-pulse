
-- Lock SECURITY DEFINER helpers: only the DB engine needs to call them (via RLS / triggers).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_weekly_post_limit() FROM anon, authenticated, public;
