-- Tighten social_post_media public read to only media whose post is published
-- AND whose owner has explicitly enabled a public profile. This scopes public
-- media exposure to opted-in agents and prevents any leak of media from users
-- who never intended public visibility.
DROP POLICY IF EXISTS "Anyone can view media of published posts" ON public.social_post_media;

CREATE POLICY "Public can view media of published posts by public agents"
  ON public.social_post_media
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.social_posts p
      JOIN public.profiles pr ON pr.id = p.user_id
      WHERE p.id = social_post_media.post_id
        AND p.status = 'published'::social_post_status
        AND pr.public_enabled = true
    )
  );