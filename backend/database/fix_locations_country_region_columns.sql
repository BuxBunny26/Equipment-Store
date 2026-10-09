-- Fix: "Add Location" fails with
--   Could not find the 'country' column of 'locations' in the schema cache
--
-- Settings -> Locations (frontend/src/pages/Settings.js, LocationsSettings)
-- has always sent `country` and `region` when creating/grouping locations,
-- but the live `locations` table was only ever created with the columns in
-- backend/database/schema.sql (id, name, description, type, customer_id,
-- is_active, created_at, updated_at) -- country/region were never migrated
-- onto the real table, so every insert from that form has always failed.
--
-- Safe to run multiple times (IF NOT EXISTS guards).
-- Run once in the Supabase SQL editor.

ALTER TABLE locations ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS region VARCHAR(100);

-- Existing rows are intentionally left with country/region = NULL (they'll
-- keep showing under "Other" / "Unassigned", same as before this fix --
-- some existing names like "Mozambique" or "Namibia" are themselves
-- site/region names, so guessing a country per row here would risk
-- mislabeling them). New locations added via the UI going forward will
-- have both fields populated correctly.

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'locations'
ORDER BY ordinal_position;
