
CREATE POLICY "Authenticated users can upload lead exports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lead-exports');

CREATE POLICY "Authenticated users can read lead exports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lead-exports');
