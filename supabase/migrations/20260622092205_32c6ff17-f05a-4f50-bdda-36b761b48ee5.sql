ALTER TABLE public.leads
  ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX leads_assigned_to_idx ON public.leads(assigned_to);