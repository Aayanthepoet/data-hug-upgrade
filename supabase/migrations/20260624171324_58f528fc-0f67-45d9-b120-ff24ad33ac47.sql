
CREATE TABLE public.lookup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line1 text NOT NULL,
  city text,
  state text,
  zip text,
  match_count integer NOT NULL DEFAULT 0,
  provider text,
  used_fallback boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookup_history TO authenticated;
GRANT ALL ON public.lookup_history TO service_role;
ALTER TABLE public.lookup_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their lookup history" ON public.lookup_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX lookup_history_user_created_idx ON public.lookup_history (user_id, created_at DESC);
