-- Fix CRITICAL finding: leads table missing SELECT policy for non-admin authenticated users.
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;

CREATE POLICY "Users can view own leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );