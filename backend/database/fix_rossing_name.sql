-- Fix mojibake in CNNC Rossing Uranium display name (ö rendered as ├╢)
-- Run once in Supabase SQL editor.

UPDATE customers
SET display_name = REPLACE(display_name, 'R├╢ssing', 'Rossing')
WHERE display_name ILIKE '%R├╢ssing%';

-- Verify
SELECT id, customer_number, display_name, billing_country
FROM customers
WHERE display_name ILIKE '%Rossing%';
