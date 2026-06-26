
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_active_subscription(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status IN ('active', 'trialing', 'past_due')
      AND (current_period_end IS NULL OR current_period_end > now() - interval '1 day')
  )
$$;

REVOKE ALL ON FUNCTION public.has_active_subscription(UUID) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.has_active_subscription(UUID);

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT private.has_active_subscription(_user_id)
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated;
