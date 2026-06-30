
CREATE TABLE public.user_skiptrace_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('batchdata','idi','tlo','reiskip','whitepages')),
  api_key_encrypted text NOT NULL,
  api_key_last4 text,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skiptrace_credentials TO authenticated;
GRANT ALL ON public.user_skiptrace_credentials TO service_role;

ALTER TABLE public.user_skiptrace_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skiptrace_creds_own_select"
  ON public.user_skiptrace_credentials FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "skiptrace_creds_own_insert"
  ON public.user_skiptrace_credentials FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "skiptrace_creds_own_update"
  ON public.user_skiptrace_credentials FOR UPDATE
  TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "skiptrace_creds_own_delete"
  ON public.user_skiptrace_credentials FOR DELETE
  TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_user_skiptrace_credentials_updated_at
  BEFORE UPDATE ON public.user_skiptrace_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
