CREATE TABLE public.lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lead_assignments TO authenticated;
GRANT ALL ON public.lead_assignments TO service_role;

ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read assignment history" ON public.lead_assignments
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX lead_assignments_lead_idx ON public.lead_assignments(lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_lead_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.lead_assignments (lead_id, assigned_to, assigned_by)
      VALUES (NEW.id, NEW.assigned_to, auth.uid());
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.lead_assignments (lead_id, assigned_to, assigned_by)
      VALUES (NEW.id, NEW.assigned_to, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_log_assignment
AFTER INSERT OR UPDATE OF assigned_to ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_assignment();