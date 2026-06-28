
CREATE OR REPLACE FUNCTION public.reschedule_distress_cron_jobs(_apikey text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base text := 'https://project--f060fcf2-0071-41a6-8014-e8dd9520d418.lovable.app';
  _headers text;
  _result jsonb := '{}'::jsonb;
  _id bigint;
BEGIN
  IF _apikey IS NULL OR length(_apikey) < 16 THEN
    RAISE EXCEPTION 'invalid apikey';
  END IF;

  _headers := jsonb_build_object(
    'Content-Type','application/json',
    'apikey', _apikey
  )::text;

  -- close-expired-auctions: every minute
  BEGIN PERFORM cron.unschedule('close-expired-auctions'); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT cron.schedule(
    'close-expired-auctions',
    '* * * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $cmd$, _base || '/api/public/hooks/close-auctions', _headers)
  ) INTO _id;
  _result := _result || jsonb_build_object('close-expired-auctions', _id);

  -- sync-distressed-nightly: 08:10 UTC daily
  BEGIN PERFORM cron.unschedule('sync-distressed-nightly'); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT cron.schedule(
    'sync-distressed-nightly',
    '10 8 * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $cmd$, _base || '/api/public/hooks/sync-distressed', _headers)
  ) INTO _id;
  _result := _result || jsonb_build_object('sync-distressed-nightly', _id);

  -- compliance-digest-weekly: Mondays 09:00 UTC
  BEGIN PERFORM cron.unschedule('compliance-digest-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT cron.schedule(
    'compliance-digest-weekly',
    '0 9 * * 1',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $cmd$, _base || '/api/public/hooks/compliance-digest', _headers)
  ) INTO _id;
  _result := _result || jsonb_build_object('compliance-digest-weekly', _id);

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_distress_cron_jobs(text) FROM PUBLIC;
