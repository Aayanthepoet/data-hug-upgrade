
CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _phone IS NULL THEN NULL
    ELSE regexp_replace(_phone, '[^0-9+]', '', 'g')
  END
$$;

CREATE OR REPLACE FUNCTION public.is_phone_suppressed(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sms_opt_outs
    WHERE restored_at IS NULL
      AND public.normalize_phone(phone) = public.normalize_phone(_phone)
  )
$$;

REVOKE ALL ON FUNCTION public.is_phone_suppressed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_phone_suppressed(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.normalize_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO authenticated, service_role, anon;
