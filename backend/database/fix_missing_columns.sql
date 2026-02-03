-- Migration: Add missing current_customer_id column to equipment table
-- Run this on your production Supabase database

-- 1. Add current_customer_id column to equipment table if it doesn't exist
ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS current_customer_id INTEGER REFERENCES customers(id);

-- 2. Add customer_id column to equipment_movements table if it doesn't exist
ALTER TABLE equipment_movements 
ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);

-- 3. Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'equipment' 
AND column_name IN ('current_customer_id', 'current_holder_id', 'current_location_id')
ORDER BY column_name;
