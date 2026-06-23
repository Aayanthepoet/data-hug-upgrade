
-- Helper: only admins can run this; writes/updates two vault secrets used
-- by dispatch_notification to POST to /api/public/hooks/notify-sms.
CREATE OR REPLACE FUNCTION public.seed_notify_vault(_url text, _secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _url IS NULL OR length(_url) < 8 THEN
    RAISE EXCEPTION 'invalid url';
  END IF;
  IF _secret IS NULL OR length(_secret) < 8 THEN
    RAISE EXCEPTION 'invalid secret';
  END IF;

  -- project_url
  SELECT id INTO _sid FROM vault.secrets WHERE name = 'project_url';
  IF _sid IS NULL THEN
    PERFORM vault.create_secret(_url, 'project_url');
  ELSE
    PERFORM vault.update_secret(_sid, _url, 'project_url');
  END IF;

  -- notify_hook_secret
  SELECT id INTO _sid FROM vault.secrets WHERE name = 'notify_hook_secret';
  IF _sid IS NULL THEN
    PERFORM vault.create_secret(_secret, 'notify_hook_secret');
  ELSE
    PERFORM vault.update_secret(_sid, _secret, 'notify_hook_secret');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_notify_vault(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seed_notify_vault(text, text) TO authenticated, service_role;
