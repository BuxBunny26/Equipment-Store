-- Fix mojibake on Dürr Africa customer name.
-- The display_name was imported as "D├╝rr ..." (UTF-8 bytes mis-decoded as CP850/CP437).
-- Run once in the Supabase SQL editor.

UPDATE customers
SET display_name = 'Dürr Africa (Pty) Ltd - Balancing & Assembly Products'
WHERE customer_number = 'CUS-00040'
   OR display_name LIKE 'D├╝rr Africa%'
   OR display_name LIKE 'D%rr Africa%';

-- Verify:
-- SELECT id, customer_number, display_name FROM customers WHERE display_name ILIKE '%rr Africa%';
