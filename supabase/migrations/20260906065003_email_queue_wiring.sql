-- Wire up the email queue consumer.
--
-- The queue had no consumer at all: cron.job was empty, email_queue_wake was
-- attached to nothing, and both queue functions POSTed to a dead Lovable
-- preview host. This migration fixes the plumbing and widens the send-log
-- status vocabulary so rate limits stop consuming retry budget.
--
-- Not included: the vault secret 'email_queue_service_role_key', which both
-- functions read for their Authorization header. It is added by hand in the
-- Supabase dashboard so the service role key never lands in a migration file.
-- Until it exists, both functions send "Bearer " with an empty token and the
-- endpoint answers 403.

-- 1. Dead-letter queues -----------------------------------------------------
-- Both were declared in 20260620144238_email_infra.sql but are absent from the
-- live database: the two main queues were recreated on 2026-09-06 without them.
-- move_to_dlq() self-heals on undefined_table, so this is belt-and-braces --
-- it makes the queue set explicit rather than a side effect of the first failure.
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. Arming moves from a trigger into enqueue_email --------------------------
-- A trigger on pgmq.q_* does not survive the queue being dropped and recreated,
-- which has already happened here once (both queues date from 2026-09-06 and
-- carry no triggers). Calling the wake from inside public.enqueue_email instead
-- ties arming to the API every producer already goes through, so it survives
-- queue recreation.
--
-- email_queue_wake therefore stops being a trigger function and returns void.
-- A return type cannot be changed by CREATE OR REPLACE, so it is dropped and
-- recreated; any stale trigger is removed first so the DROP cannot fail.
DROP TRIGGER IF EXISTS email_queue_wake_auth ON pgmq.q_auth_emails;
DROP TRIGGER IF EXISTS email_queue_wake_transactional ON pgmq.q_transactional_emails;
DROP FUNCTION IF EXISTS public.email_queue_wake();

CREATE FUNCTION public.email_queue_wake()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Called from inside public.enqueue_email, so this runs in the enqueue
  -- transaction. Every failure path below is swallowed: arming the consumer
  -- must never roll back or block the caller's email. Shared advisory lock
  -- serializes arming against email_queue_dispatch's disarm.
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    BEGIN
      PERFORM cron.schedule('process-email-queue', '5 seconds', $cron$ SELECT public.email_queue_dispatch(); $cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_wake: cron schedule failed: %', SQLERRM;
    END;
  END IF;

  -- Nudge the dispatcher immediately so the first message does not wait for the
  -- next cron tick. pg_net queues the request and sends it after commit.
  BEGIN
    PERFORM net.http_post(
      url := 'https://propai-psi.vercel.app/lovable/email/queue/process',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'cron',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_queue_wake failed (enqueue preserved): %', SQLERRM;
END;
$function$;

-- Only enqueue_email calls this, and it does so as the definer (postgres), so
-- no client role needs EXECUTE. The DROP above reset the ACL to the PUBLIC
-- default; lock it back down rather than leaving it wider than it was.
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO postgres, service_role;

-- enqueue_email keeps its undefined_table auto-create, then arms the consumer
-- once the message is actually queued. The wake call carries its own handler on
-- top of the one inside email_queue_wake: the send is committed work and
-- nothing about waking the consumer may undo it.
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  msg_id bigint;
BEGIN
  BEGIN
    msg_id := pgmq.send(queue_name, payload);
  EXCEPTION WHEN undefined_table THEN
    PERFORM pgmq.create(queue_name);
    msg_id := pgmq.send(queue_name, payload);
  END;

  BEGIN
    PERFORM public.email_queue_wake();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_email: wake failed (message % queued): %', msg_id, SQLERRM;
  END;

  RETURN msg_id;
END;
$function$;

-- 3. Point the dispatcher at the live deployment -----------------------------
-- Only the url argument changes; the body is otherwise byte-identical to what
-- is deployed today, including the advisory-lock arm/disarm protocol.
CREATE OR REPLACE FUNCTION public.email_queue_dispatch()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
     AND NOT EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
    BEGIN
      -- Serialize disarm against email_queue_wake on a shared advisory lock, then
      -- re-read under it: an enqueue racing the unschedule either committed (we
      -- see its row and leave the cron) or waits and re-arms after we commit.
      PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
      IF EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
         OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
        RETURN;
      END IF;
      PERFORM cron.unschedule('process-email-queue');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_dispatch: cron unschedule failed: %', SQLERRM;
    END;
    RETURN;
  END IF;

  IF (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now() THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://propai-psi.vercel.app/lovable/email/queue/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$function$;

-- 4. rate_limited status -----------------------------------------------------
-- The dispatcher counts email_send_log rows with status='failed' as its retry
-- budget. Logging a 429 as 'failed' meant five rate limits DLQ'd a message that
-- never actually failed to send. Giving rate limits their own status excludes
-- them from that tally without touching the counting query.
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'rate_limited', 'bounced', 'complained', 'dlq'));
END $$;
