-- Lock down SECURITY DEFINER helpers so they can only be invoked internally
-- (by pg_cron and the trigger owner), not by anon/authenticated API roles.
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;