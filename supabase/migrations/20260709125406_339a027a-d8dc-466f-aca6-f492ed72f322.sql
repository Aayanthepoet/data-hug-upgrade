
CREATE TABLE public.title_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX title_searches_user_created_idx ON public.title_searches (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_searches TO authenticated;
GRANT ALL ON public.title_searches TO service_role;

ALTER TABLE public.title_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own title searches"
  ON public.title_searches FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);
