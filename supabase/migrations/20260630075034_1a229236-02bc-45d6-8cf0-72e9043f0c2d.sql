ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS zoning_code text,
  ADD COLUMN IF NOT EXISTS zoning_long_code text;

CREATE INDEX IF NOT EXISTS properties_zoning_code_idx ON public.properties (zoning_code);