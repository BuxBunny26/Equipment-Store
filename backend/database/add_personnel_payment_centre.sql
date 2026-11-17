-- ============================================
-- Add personnel.payment_centre
-- ============================================
-- personnel.division has historically held payment_centre-style values
-- (e.g. "GP Consult", "WearCheck", "RS") for ~69% of rows instead of the
-- true AFS/ARC division. This adds a dedicated column so payment_centre and
-- division can be stored separately going forward.
--
-- Run this BEFORE database/fix_division_payment_centre.js.
-- Run in Supabase SQL Editor (or via psql against the Supabase connection).

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS payment_centre VARCHAR(100);
