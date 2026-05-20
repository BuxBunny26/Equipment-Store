-- ============================================
-- FIX: Storage RLS policies for anon role
-- ============================================
-- Run this in the Supabase SQL Editor (production project).
-- The app uses the anon key (no Supabase Auth), so storage.objects
-- needs explicit policies allowing anon to read/write to the
-- public buckets used by this app:
--   - calibration-certificates
--   - equipment-images
--   - movement-photos
--
-- Without these policies you get:
--   "new row violates row-level security policy"
-- when uploading.
-- ============================================

-- Make sure the buckets exist and are public (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES
    ('calibration-certificates', 'calibration-certificates', true),
    ('equipment-images',         'equipment-images',         true),
    ('movement-photos',          'movement-photos',          true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Drop any prior versions of these policies so this script is re-runnable
DROP POLICY IF EXISTS "App buckets: anon read"   ON storage.objects;
DROP POLICY IF EXISTS "App buckets: anon insert" ON storage.objects;
DROP POLICY IF EXISTS "App buckets: anon update" ON storage.objects;
DROP POLICY IF EXISTS "App buckets: anon delete" ON storage.objects;

-- Allow anyone (anon + authenticated) to read objects in these buckets
CREATE POLICY "App buckets: anon read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('calibration-certificates', 'equipment-images', 'movement-photos'));

-- Allow anyone to upload to these buckets
CREATE POLICY "App buckets: anon insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id IN ('calibration-certificates', 'equipment-images', 'movement-photos'));

-- Allow anyone to update (e.g. overwrite) objects in these buckets
CREATE POLICY "App buckets: anon update"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id IN ('calibration-certificates', 'equipment-images', 'movement-photos'))
WITH CHECK (bucket_id IN ('calibration-certificates', 'equipment-images', 'movement-photos'));

-- Allow anyone to delete objects in these buckets
CREATE POLICY "App buckets: anon delete"
ON storage.objects FOR DELETE
TO public
USING (bucket_id IN ('calibration-certificates', 'equipment-images', 'movement-photos'));
