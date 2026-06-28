
-- 1) CRITICAL: remove admin read-all on social_accounts (OAuth tokens)
DROP POLICY IF EXISTS "Admins view all social accounts" ON public.social_accounts;

-- 2) Leads: allow authenticated users to insert (self-assignable)
CREATE POLICY "Authenticated users can create leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (assigned_to IS NULL OR assigned_to = auth.uid());

-- 3) compliance_digest_reads: drop the admin-gated policy, add owner + admin policies
DROP POLICY IF EXISTS "Users manage own digest reads" ON public.compliance_digest_reads;

CREATE POLICY "Users manage own digest reads"
  ON public.compliance_digest_reads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all digest reads"
  ON public.compliance_digest_reads
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Storage: owner UPDATE/DELETE on lead-exports
CREATE POLICY "Lead exports: owner update own folder"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lead-exports' AND (storage.foldername(name))[1] = (auth.uid())::text)
  WITH CHECK (bucket_id = 'lead-exports' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Lead exports: owner delete own folder"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'lead-exports' AND (storage.foldername(name))[1] = (auth.uid())::text);
