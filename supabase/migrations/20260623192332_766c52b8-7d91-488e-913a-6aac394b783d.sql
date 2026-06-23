
-- Replace the INSERT and UPDATE policies on the avatars bucket with versions
-- that enforce a 5MB size limit and an allow-list of image mime types.

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND COALESCE((metadata->>'size')::bigint, 0) <= 5242880
  AND COALESCE(metadata->>'mimetype', '') IN (
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'
  )
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND COALESCE((metadata->>'size')::bigint, 0) <= 5242880
  AND COALESCE(metadata->>'mimetype', '') IN (
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'
  )
);
