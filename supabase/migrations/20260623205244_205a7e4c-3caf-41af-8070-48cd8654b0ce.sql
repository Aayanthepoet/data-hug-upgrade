
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_name text NOT NULL,
  seller_name text NOT NULL,
  buyer_email text,
  seller_email text,
  purchase_price numeric(14,2) NOT NULL CHECK (purchase_price >= 0),
  closing_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','viewed','signed','declined','cancelled','error')),
  pdf_storage_path text,
  signwell_document_id text,
  signed_pdf_url text,
  signed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contracts_user_property_idx ON public.contracts (user_id, property_id, created_at DESC);
CREATE INDEX contracts_signwell_idx ON public.contracts (signwell_document_id) WHERE signwell_document_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER contracts_set_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies on the private 'contracts' bucket.
-- Files live at: contracts/{user_id}/{filename}
CREATE POLICY "Contracts: owner read own folder"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Contracts: owner write own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Contracts: owner update own folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Contracts: owner delete own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Contracts: admins read all"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts'
    AND public.has_role(auth.uid(), 'admin')
  );
