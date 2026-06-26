
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS neighborhood text;
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON public.properties (neighborhood) WHERE neighborhood IS NOT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text;

CREATE INDEX IF NOT EXISTS idx_leads_zip ON public.leads (zip) WHERE zip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_state_city ON public.leads (state, city) WHERE city IS NOT NULL;
