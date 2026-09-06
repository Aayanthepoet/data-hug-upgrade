-- Recreate the four Supabase Storage buckets and their storage.objects RLS
-- policies.
--
-- WHY THIS EXISTS
-- The buckets were only ever created through the Supabase dashboard in the
-- original (Lovable-managed) project, so nothing in migrations/ created them.
-- The 2026-09-03 move to a fresh project restored the SQL schema and table
-- data but not Storage: `select count(*) from storage.buckets` returned 0, and
-- storage.objects carried 0 policies. Every upload path in the app therefore
-- fails with "Bucket not found".
--
-- This migration makes both halves reproducible. It is idempotent and safe to
-- re-run: bucket inserts use ON CONFLICT DO NOTHING, and every policy is
-- dropped before being recreated.
--
-- All four buckets are PRIVATE. Nothing here is served publicly; the app hands
-- out short-lived signed URLs instead.
--
-- POLICY SET
-- These reproduce the *final* state of the policies as they stood after the
-- original migrations, not a replay of their history. Superseded definitions
-- are deliberately not recreated:
--   - "Authenticated users can read/upload lead exports" (20260622093339) were
--     bucket-wide and were dropped by 20260624081628 in favour of owner-folder
--     scoping. They stay dropped.
--   - The avatars INSERT/UPDATE policies are the 20260623192332 versions that
--     add a 5 MB cap and a mime allow-list, not the unrestricted 20260623191609
--     originals.
--
-- Path convention for all four buckets: <auth.uid()>/<filename>, so every
-- policy keys on (storage.foldername(name))[1].

-- ---------------------------------------------------------------------------
-- 1. Buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('avatars',        'avatars',        false),
  ('contracts',      'contracts',      false),
  ('lead-exports',   'lead-exports',   false),
  ('vision-renders', 'vision-renders', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. storage.objects policies
--
-- RLS is already enabled on storage.objects by Supabase; we only add policies.
-- ---------------------------------------------------------------------------

-- --- avatars -----------------------------------------------------------------
-- Read/delete: owner folder only. Insert/update additionally enforce a 5 MB
-- cap and an image mime allow-list (from 20260623192332).

drop policy if exists "Users can read their own avatar" on storage.objects;
create policy "Users can read their own avatar"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and coalesce((metadata->>'size')::bigint, 0) <= 5242880
    and coalesce(metadata->>'mimetype', '') in (
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'
    )
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and coalesce((metadata->>'size')::bigint, 0) <= 5242880
    and coalesce(metadata->>'mimetype', '') in (
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'
    )
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --- contracts ---------------------------------------------------------------
-- Owner CRUD on their own folder, plus admin read-all (20260623205244).
-- Files live at contracts/<user_id>/<filename>.

drop policy if exists "Contracts: owner read own folder" on storage.objects;
create policy "Contracts: owner read own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Contracts: owner write own folder" on storage.objects;
create policy "Contracts: owner write own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Contracts: owner update own folder" on storage.objects;
create policy "Contracts: owner update own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Contracts: owner delete own folder" on storage.objects;
create policy "Contracts: owner delete own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Contracts: admins read all" on storage.objects;
create policy "Contracts: admins read all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contracts'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- --- lead-exports ------------------------------------------------------------
-- Owner-folder scoping from 20260624081628, plus the owner update/delete
-- policies added in 20260628220537, plus admin read-all.

drop policy if exists "Lead exports: owner read own folder" on storage.objects;
create policy "Lead exports: owner read own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'lead-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Lead exports: owner write own folder" on storage.objects;
create policy "Lead exports: owner write own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lead-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Lead exports: owner update own folder" on storage.objects;
create policy "Lead exports: owner update own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'lead-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'lead-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Lead exports: owner delete own folder" on storage.objects;
create policy "Lead exports: owner delete own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'lead-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Lead exports: admins read all" on storage.objects;
create policy "Lead exports: admins read all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'lead-exports'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- --- vision-renders ----------------------------------------------------------
-- From 20260623104803. Note there is deliberately no UPDATE policy here: the
-- original migration never defined one, and the render pipeline writes through
-- supabaseAdmin (service role), which bypasses RLS. These three exist so a
-- user-scoped client can still read and delete its own renders.
-- Paths: vision-renders/<user_id>/<render_id>.png and
--        vision-renders/<user_id>/sources/<photo_id>.<ext>
-- Both nest under the uid as folder 1, so one predicate covers each.

drop policy if exists "vision_renders_owner_read" on storage.objects;
create policy "vision_renders_owner_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vision-renders'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "vision_renders_owner_write" on storage.objects;
create policy "vision_renders_owner_write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vision-renders'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "vision_renders_owner_delete" on storage.objects;
create policy "vision_renders_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vision-renders'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
