-- Add purchase_date to equipment table for age tracking
-- Run this on your Supabase SQL editor

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_date DATE;

-- Backfill: set purchase_date to created_at for existing equipment
UPDATE equipment SET purchase_date = created_at::date WHERE purchase_date IS NULL;

-- Allow purchase_date through RLS if policies exist
-- (Supabase policies usually allow all columns already if the row is accessible)
