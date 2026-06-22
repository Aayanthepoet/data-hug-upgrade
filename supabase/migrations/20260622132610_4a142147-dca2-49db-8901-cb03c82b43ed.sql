ALTER TABLE public.outreach_messages
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS to_value text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS outreach_messages_user_owner_idx
  ON public.outreach_messages(user_id, owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS outreach_messages_user_created_idx
  ON public.outreach_messages(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS outreach_messages_provider_msg_uidx
  ON public.outreach_messages(provider, provider_message_id)
  WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;

-- Updated_at trigger if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'outreach_messages_set_updated_at'
  ) THEN
    CREATE TRIGGER outreach_messages_set_updated_at
      BEFORE UPDATE ON public.outreach_messages
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;