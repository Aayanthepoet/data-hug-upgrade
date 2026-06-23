
CREATE TABLE public.sms_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  keyword text,
  reason text,
  source text NOT NULL DEFAULT 'inbound_sms',
  notes text,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz,
  restored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sms_opt_outs_phone_active_uidx
  ON public.sms_opt_outs (phone) WHERE restored_at IS NULL;
CREATE INDEX sms_opt_outs_opted_out_at_idx
  ON public.sms_opt_outs (opted_out_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_opt_outs TO authenticated;
GRANT ALL ON public.sms_opt_outs TO service_role;

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage opt-outs"
  ON public.sms_opt_outs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER sms_opt_outs_set_updated_at
  BEFORE UPDATE ON public.sms_opt_outs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
