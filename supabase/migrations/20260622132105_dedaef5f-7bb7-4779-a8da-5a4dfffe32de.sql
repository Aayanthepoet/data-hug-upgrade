-- Comparable sales for a subject property
CREATE TABLE public.comps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  address text NOT NULL,
  city text,
  state text,
  zip text,
  sale_price numeric NOT NULL,
  sale_date date NOT NULL,
  distance_miles numeric,
  sqft integer,
  beds numeric,
  baths numeric,
  year_built integer,
  property_type text,
  similarity_score integer,
  source_provider text NOT NULL DEFAULT 'mock',
  source_record_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comps_subject_idx ON public.comps(subject_property_id);
CREATE INDEX comps_user_idx ON public.comps(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comps TO authenticated;
GRANT ALL ON public.comps TO service_role;
ALTER TABLE public.comps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own comps"
  ON public.comps FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Cached ARV estimate per property
CREATE TABLE public.arv_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  arv numeric NOT NULL,
  arv_low numeric NOT NULL,
  arv_high numeric NOT NULL,
  price_per_sqft numeric,
  comp_count integer NOT NULL,
  confidence integer NOT NULL,
  method text NOT NULL DEFAULT 'ppsf_median',
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX arv_estimates_user_idx ON public.arv_estimates(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.arv_estimates TO authenticated;
GRANT ALL ON public.arv_estimates TO service_role;
ALTER TABLE public.arv_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own ARV estimates"
  ON public.arv_estimates FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER arv_estimates_set_updated_at
  BEFORE UPDATE ON public.arv_estimates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();