
-- Remove the row policy that exposed every profile column publicly
DROP POLICY IF EXISTS "Anyone can view enabled public agent profiles" ON public.profiles;

-- Safe public view: only the public_* fields plus id, full_name, public_slug
CREATE OR REPLACE VIEW public.public_profiles
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

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;
