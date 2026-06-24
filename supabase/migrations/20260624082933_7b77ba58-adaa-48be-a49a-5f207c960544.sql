
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE VIEW private.public_profiles
WITH (security_invoker = false) AS
SELECT
  id,
  full_name,
  public_slug,
  public_enabled,
  public_headshot_url,
  public_bio,
  public_phone,
  public_email,
  public_brokerage,
  public_license,
  public_service_areas
FROM public.profiles
WHERE public_enabled = true AND public_slug IS NOT NULL;

REVOKE ALL ON private.public_profiles FROM PUBLIC;
GRANT SELECT ON private.public_profiles TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT * FROM private.public_profiles;

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;
