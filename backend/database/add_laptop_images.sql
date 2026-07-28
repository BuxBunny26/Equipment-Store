-- Laptop Images Migration
-- Adds support for uploading/attaching photos to a laptop assignment
-- (e.g. photos of the device, damage, accessories, etc.)
-- Run this in the Supabase SQL Editor.

-- ============================================
-- Table
-- ============================================
CREATE TABLE IF NOT EXISTS laptop_images (
    id SERIAL PRIMARY KEY,
    laptop_assignment_id INTEGER NOT NULL REFERENCES laptop_assignments(id) ON DELETE CASCADE,
    filename VARCHAR(500),
    original_filename VARCHAR(500),
    file_path TEXT,
    file_size INTEGER,
    mime_type VARCHAR(100),
    caption TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    uploaded_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_laptop_images_assignment ON laptop_images(laptop_assignment_id);

ALTER TABLE laptop_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON laptop_images;
CREATE POLICY "Allow all for authenticated users" ON laptop_images
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Storage bucket
-- ============================================
-- Create (or update) the public "laptop-images" bucket used to store the
-- actual image files. Idempotent - safe to re-run.
INSERT INTO storage.buckets (id, name, public)
VALUES ('laptop-images', 'laptop-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Allow anon/authenticated access to the laptop-images bucket, matching the
-- policies used for the other app buckets (see fix_storage_rls.sql).
DROP POLICY IF EXISTS "Laptop images: anon read" ON storage.objects;
DROP POLICY IF EXISTS "Laptop images: anon insert" ON storage.objects;
DROP POLICY IF EXISTS "Laptop images: anon update" ON storage.objects;
DROP POLICY IF EXISTS "Laptop images: anon delete" ON storage.objects;

CREATE POLICY "Laptop images: anon read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'laptop-images');

CREATE POLICY "Laptop images: anon insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'laptop-images');

CREATE POLICY "Laptop images: anon update"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'laptop-images')
WITH CHECK (bucket_id = 'laptop-images');

CREATE POLICY "Laptop images: anon delete"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'laptop-images');
