DROP POLICY IF EXISTS "Authenticated can write market intel cache" ON public.market_intel_cache;
DROP POLICY IF EXISTS "Authenticated can update market intel cache" ON public.market_intel_cache;
REVOKE INSERT, UPDATE, DELETE ON public.market_intel_cache FROM authenticated;