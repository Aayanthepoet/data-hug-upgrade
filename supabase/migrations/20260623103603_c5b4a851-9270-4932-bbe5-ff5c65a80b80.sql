
CREATE TABLE public.compliance_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_start)
);
GRANT SELECT ON public.compliance_digests TO authenticated;
GRANT ALL ON public.compliance_digests TO service_role;
ALTER TABLE public.compliance_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view digests"
  ON public.compliance_digests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.compliance_digest_reads (
  digest_id UUID NOT NULL REFERENCES public.compliance_digests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (digest_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.compliance_digest_reads TO authenticated;
GRANT ALL ON public.compliance_digest_reads TO service_role;
ALTER TABLE public.compliance_digest_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own digest reads"
  ON public.compliance_digest_reads FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));
