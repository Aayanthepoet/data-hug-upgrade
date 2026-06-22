
-- Distress type enum
CREATE TYPE public.distress_type AS ENUM (
  'reo',
  'preforeclosure',
  'auction',
  'tax_lien',
  'tax_delinquent',
  'fsbo_stale',
  'vacant',
  'absentee',
  'none'
);

CREATE TYPE public.listing_status AS ENUM (
  'active',
  'pending',
  'sold',
  'off_market',
  'auction_scheduled',
  'foreclosed'
);

-- Extend properties
ALTER TABLE public.properties
  ADD COLUMN distress_type public.distress_type NOT NULL DEFAULT 'none',
  ADD COLUMN listing_status public.listing_status,
  ADD COLUMN list_price numeric,
  ADD COLUMN list_date date,
  ADD COLUMN days_on_market integer,
  ADD COLUMN auction_date date,
  ADD COLUMN tax_owed numeric,
  ADD COLUMN lien_amount numeric,
  ADD COLUMN source_provider text,
  ADD COLUMN source_record_id text,
  ADD COLUMN last_synced_at timestamptz;

CREATE INDEX idx_properties_distress ON public.properties (distress_type, state, zip);
CREATE INDEX idx_properties_dom ON public.properties (days_on_market) WHERE days_on_market IS NOT NULL;
CREATE INDEX idx_properties_source ON public.properties (source_provider, source_record_id);
CREATE UNIQUE INDEX idx_properties_source_unique
  ON public.properties (user_id, source_provider, source_record_id)
  WHERE source_provider IS NOT NULL AND source_record_id IS NOT NULL;

-- Distress events history
CREATE TABLE public.distress_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type public.distress_type NOT NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric,
  note text,
  source_provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.distress_events TO authenticated;
GRANT ALL ON public.distress_events TO service_role;
ALTER TABLE public.distress_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their distress events"
  ON public.distress_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_distress_events_property ON public.distress_events (property_id, event_date DESC);

-- Saved searches
CREATE TABLE public.saved_searches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  last_match_count integer,
  is_scheduled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their saved searches"
  ON public.saved_searches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
