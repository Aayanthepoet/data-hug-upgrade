
-- 1. audit_logs: remove user-controlled insert policy (service role still writes via RLS bypass)
DROP POLICY IF EXISTS "Users insert their own audit logs" ON public.audit_logs;

-- 2. bids: remove broad visibility for any authenticated user
DROP POLICY IF EXISTS "Authenticated view bids on active auctions" ON public.bids;

-- 3. lead-exports storage: scope to owner folder
DROP POLICY IF EXISTS "Authenticated users can read lead exports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload lead exports" ON storage.objects;

CREATE POLICY "Lead exports: owner read own folder"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lead-exports'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "Lead exports: owner write own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lead-exports'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "Lead exports: admins read all"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lead-exports'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 4. profiles: hide private email column from anonymous (public scrape) callers.
--    Authenticated users still need email for self-view (settings, team list, etc.).
REVOKE SELECT (email) ON public.profiles FROM anon;

-- 5. Set fixed search_path on email queue helpers
ALTER FUNCTION public.enqueue_email(text, jsonb)            SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint)            SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb)   SET search_path = public;

-- 6. Lock down SECURITY DEFINER functions that should not be callable from the API.
--    has_role MUST remain executable by authenticated (used in many RLS policies).
REVOKE EXECUTE ON FUNCTION public.close_auction_if_expired(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_expired_auctions(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_notification(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_phone_suppressed(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_lead_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_auction_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_inbound_outreach() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_bid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_lead() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_notify_vault(text, text) FROM PUBLIC, anon, authenticated;
