ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_status text,
  ADD COLUMN IF NOT EXISTS last_sync_error_code text,
  ADD COLUMN IF NOT EXISTS last_sync_error_message text,
  ADD COLUMN IF NOT EXISTS sync_retry_after timestamptz,
  ADD COLUMN IF NOT EXISTS sync_attempt_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS social_accounts_last_synced_at_idx
  ON public.social_accounts (last_synced_at);

CREATE INDEX IF NOT EXISTS social_accounts_user_platform_status_idx
  ON public.social_accounts (user_id, platform, status);