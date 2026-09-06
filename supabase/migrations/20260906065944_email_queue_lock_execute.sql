-- Restrict the email queue plumbing to server-side callers.
--
-- Every function below is SECURITY DEFINER, so it bypasses RLS by design and
-- EXECUTE is the only access control left on it. All of them were reachable by
-- anon and authenticated over PostgREST, which meant an unauthenticated caller
-- could:
--
--   enqueue_email      inject an arbitrary payload the dispatcher then SENDS
--                      from the verified sender domain
--   move_to_dlq        same injection via its dlq_name + payload arguments,
--                      and bury real messages
--   read_email_batch   read queued mail -- recipient addresses, rendered HTML
--                      and unsubscribe tokens -- and hide it behind a new VT
--   delete_email       silently drop queued mail
--   email_queue_dispatch  drive the vault-authenticated dispatch endpoint
--
-- 20260624081628_258b6603-...sql already revoked this for enqueue_email; the
-- grant came back when the function was later dropped and recreated. Re-running
-- this migration restores the intended state. Note it is not self-healing: a
-- future DROP + CREATE resets the ACL to the PUBLIC default again. The only
-- automatic guard would be ALTER DEFAULT PRIVILEGES on the whole schema, which
-- is not appropriate here -- all 24 functions in public are currently reachable
-- by authenticated, so a blanket default would revoke the app's own RPCs.
--
-- Every legitimate caller already uses the service role key
-- (send.ts, lead-notify.ts, digest.functions.ts, hooks/compliance-digest.ts,
-- queue/process.ts) or runs as postgres via pg_cron, so nothing loses access.

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO postgres, service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO postgres, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_email(text, bigint) TO postgres, service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO postgres, service_role;

REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.email_queue_dispatch() TO postgres, service_role;

-- Already locked down in 20260906065003_email_queue_wiring.sql; re-asserted so
-- this migration alone describes the finished state.
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.email_queue_wake() TO postgres, service_role;
