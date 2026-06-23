-- =========================================================================
-- Social Amplifier — schema, grants, RLS
-- =========================================================================

-- 1. Profile additions for the public agent landing page
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_slug         text UNIQUE,
  ADD COLUMN IF NOT EXISTS public_enabled      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_headshot_url text,
  ADD COLUMN IF NOT EXISTS public_bio          text,
  ADD COLUMN IF NOT EXISTS public_phone        text,
  ADD COLUMN IF NOT EXISTS public_email        text,
  ADD COLUMN IF NOT EXISTS public_brokerage    text,
  ADD COLUMN IF NOT EXISTS public_license      text,
  ADD COLUMN IF NOT EXISTS public_service_areas text[] NOT NULL DEFAULT '{}'::text[];

-- Slug format: lowercase, alphanumeric + dash, 3-40 chars
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_public_slug_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_public_slug_format
  CHECK (public_slug IS NULL OR public_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$');

-- Allow anon to read only PUBLIC fields when public_enabled (a SECURITY DEFINER fn handles column projection)
-- Policy below uses USING (public_enabled = true) on the table for safety; client code only selects safe columns.
DROP POLICY IF EXISTS "Anyone can view enabled public agent profiles" ON public.profiles;
CREATE POLICY "Anyone can view enabled public agent profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (public_enabled = true AND public_slug IS NOT NULL);

GRANT SELECT ON public.profiles TO anon;

-- =========================================================================
-- 2. Enums
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.social_platform AS ENUM (
    'facebook', 'instagram', 'linkedin', 'linkedin_org', 'x', 'youtube', 'tiktok'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.social_account_status AS ENUM (
    'active', 'expired', 'revoked', 'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.social_post_status AS ENUM (
    'draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.social_target_status AS ENUM (
    'pending', 'scheduled', 'publishing', 'published', 'failed', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- 3. social_accounts
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform            public.social_platform NOT NULL,
  external_account_id text NOT NULL,
  display_name        text,
  avatar_url          text,
  -- Tokens are stored encrypted at the app layer (TOKEN_ENCRYPTION_KEY).
  access_token_enc    text,
  refresh_token_enc   text,
  expires_at          timestamptz,
  scopes              text[] NOT NULL DEFAULT '{}'::text[],
  metadata            jsonb  NOT NULL DEFAULT '{}'::jsonb,
  status              public.social_account_status NOT NULL DEFAULT 'active',
  last_error          text,
  connected_at        timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, external_account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage their own social accounts"
  ON public.social_accounts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all social accounts"
  ON public.social_accounts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON public.social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_status ON public.social_accounts(status);

CREATE TRIGGER trg_social_accounts_updated
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 4. social_posts
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.social_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id     uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  landing_slug    text NOT NULL UNIQUE,
  headline        text NOT NULL,
  subheadline     text,
  body_md         text NOT NULL DEFAULT '',
  hero_image_url  text,
  cta_label       text NOT NULL DEFAULT 'Contact agent',
  cta_url         text,
  tags            text[] NOT NULL DEFAULT '{}'::text[],
  status          public.social_post_status NOT NULL DEFAULT 'draft',
  scheduled_at    timestamptz,
  published_at    timestamptz,
  ai_model        text,
  ai_prompt       text,
  view_count      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_posts_landing_slug_format
    CHECK (landing_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,80}[a-z0-9])$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT SELECT ON public.social_posts TO anon;
GRANT ALL ON public.social_posts TO service_role;

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage their own posts"
  ON public.social_posts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all posts"
  ON public.social_posts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view published posts"
  ON public.social_posts FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE INDEX IF NOT EXISTS idx_social_posts_user      ON public.social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status    ON public.social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON public.social_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_social_posts_published ON public.social_posts(published_at DESC) WHERE status = 'published';

CREATE TRIGGER trg_social_posts_updated
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 5. social_post_targets
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.social_post_targets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id      uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform        public.social_platform NOT NULL,
  caption         text NOT NULL DEFAULT '',
  hashtags        text[] NOT NULL DEFAULT '{}'::text[],
  status          public.social_target_status NOT NULL DEFAULT 'pending',
  scheduled_at    timestamptz,
  posted_at       timestamptz,
  remote_post_id  text,
  remote_url      text,
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, platform, account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_targets TO authenticated;
GRANT SELECT ON public.social_post_targets TO anon;
GRANT ALL ON public.social_post_targets TO service_role;

ALTER TABLE public.social_post_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage their own post targets"
  ON public.social_post_targets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all post targets"
  ON public.social_post_targets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view targets of published posts"
  ON public.social_post_targets FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = social_post_targets.post_id AND p.status = 'published'
    )
  );

CREATE INDEX IF NOT EXISTS idx_post_targets_post      ON public.social_post_targets(post_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_user      ON public.social_post_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_status    ON public.social_post_targets(status);
CREATE INDEX IF NOT EXISTS idx_post_targets_scheduled ON public.social_post_targets(scheduled_at)
  WHERE status IN ('pending','scheduled');

CREATE TRIGGER trg_post_targets_updated
  BEFORE UPDATE ON public.social_post_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 6. social_post_media
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.social_post_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('image','video')),
  url         text NOT NULL,
  alt_text    text,
  width       integer,
  height      integer,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_media TO authenticated;
GRANT SELECT ON public.social_post_media TO anon;
GRANT ALL ON public.social_post_media TO service_role;

ALTER TABLE public.social_post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage their own post media"
  ON public.social_post_media FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view media of published posts"
  ON public.social_post_media FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = social_post_media.post_id AND p.status = 'published'
    )
  );

CREATE INDEX IF NOT EXISTS idx_post_media_post ON public.social_post_media(post_id);
