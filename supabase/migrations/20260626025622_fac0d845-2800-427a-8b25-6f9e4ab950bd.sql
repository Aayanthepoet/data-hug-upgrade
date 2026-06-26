REVOKE INSERT ON public.leads FROM anon;
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;