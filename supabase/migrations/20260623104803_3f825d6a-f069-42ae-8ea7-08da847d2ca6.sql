
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS source_image_url text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS storage_path text;

CREATE INDEX IF NOT EXISTS idx_media_property ON public.media_assets(property_id);
CREATE INDEX IF NOT EXISTS idx_media_status ON public.media_assets(status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='media_assets_status_check') THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_status_check
      CHECK (status IN ('queued','rendering','ready','failed'));
  END IF;
END $$;

-- storage policies for vision-renders bucket: users manage files under their uid prefix
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vision_renders_owner_read') THEN
    CREATE POLICY "vision_renders_owner_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'vision-renders' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vision_renders_owner_write') THEN
    CREATE POLICY "vision_renders_owner_write" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'vision-renders' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vision_renders_owner_delete') THEN
    CREATE POLICY "vision_renders_owner_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'vision-renders' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
