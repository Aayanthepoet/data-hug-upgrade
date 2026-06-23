
CREATE TABLE public.vision_source_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  original_filename TEXT,
  original_byte_size BIGINT CHECK (original_byte_size IS NULL OR original_byte_size >= 0),
  was_cropped BOOLEAN NOT NULL DEFAULT false,
  crop_aspect TEXT,
  crop_max_edge INTEGER CHECK (crop_max_edge IS NULL OR (crop_max_edge BETWEEN 64 AND 8192)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX vision_source_photos_user_id_created_at_idx
  ON public.vision_source_photos (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vision_source_photos TO authenticated;
GRANT ALL ON public.vision_source_photos TO service_role;

ALTER TABLE public.vision_source_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own source photos"
  ON public.vision_source_photos
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER vision_source_photos_set_updated_at
  BEFORE UPDATE ON public.vision_source_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
