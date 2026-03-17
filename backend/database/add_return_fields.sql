-- Add return location and handover fields to vehicle_checkouts
-- Run this in Supabase SQL Editor

ALTER TABLE vehicle_checkouts ADD COLUMN IF NOT EXISTS return_location VARCHAR(200);
ALTER TABLE vehicle_checkouts ADD COLUMN IF NOT EXISTS handed_over_to VARCHAR(200);
ALTER TABLE vehicle_checkouts ADD COLUMN IF NOT EXISTS return_notes TEXT;
