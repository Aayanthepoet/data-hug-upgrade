CREATE TABLE public.market_intel_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL UNIQUE,
  location_key TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_intel_cache TO authenticated;
GRANT ALL ON public.market_intel_cache TO service_role;

ALTER TABLE public.market_intel_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read market intel cache"
  ON public.market_intel_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can write market intel cache"
  ON public.market_intel_cache FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update market intel cache"
  ON public.market_intel_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_market_intel_cache_expires ON public.market_intel_cache (expires_at);