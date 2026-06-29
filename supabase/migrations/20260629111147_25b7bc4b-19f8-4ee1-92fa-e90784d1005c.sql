
CREATE TABLE public.sms_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_text text NOT NULL,
  source text NOT NULL DEFAULT 'signup',
  ip text,
  user_agent text,
  consented_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sms_consents_user_idx ON public.sms_consents(user_id, consented_at DESC);
GRANT SELECT, INSERT ON public.sms_consents TO authenticated;
GRANT ALL ON public.sms_consents TO service_role;
ALTER TABLE public.sms_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert their own consent" ON public.sms_consents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read their own consent" ON public.sms_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
