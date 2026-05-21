-- Standardize customer billing_state values (provinces / regions).
-- Run once against Supabase. Safe to re-run (uses CASE WHEN equality).
--
-- Fixes:
--   * KwaZulu-Natal capitalisation
--   * "North-West" / "North West" merged to "North West"
--   * South African suburbs / street names mis-stored as states reset to their actual province
--   * Empty strings normalised to NULL
--   * Trim surrounding whitespace

BEGIN;

-- Trim and null-out empties
UPDATE customers
SET billing_state = NULLIF(TRIM(billing_state), '')
WHERE billing_state IS NOT NULL;

UPDATE customers
SET shipping_state = NULLIF(TRIM(shipping_state), '')
WHERE shipping_state IS NOT NULL;

-- South African canonical names
UPDATE customers SET billing_state = 'KwaZulu-Natal'
  WHERE billing_state ILIKE 'kwazulu-natal' OR billing_state ILIKE 'kwazulu natal' OR billing_state ILIKE 'kzn';

UPDATE customers SET billing_state = 'North West'
  WHERE billing_state ILIKE 'north-west' OR billing_state ILIKE 'north west' OR billing_state ILIKE 'northwest';

UPDATE customers SET billing_state = 'Eastern Cape' WHERE billing_state ILIKE 'eastern cape';
UPDATE customers SET billing_state = 'Western Cape' WHERE billing_state ILIKE 'western cape';
UPDATE customers SET billing_state = 'Northern Cape' WHERE billing_state ILIKE 'northern cape';
UPDATE customers SET billing_state = 'Free State'    WHERE billing_state ILIKE 'free state' OR billing_state ILIKE 'freestate';
UPDATE customers SET billing_state = 'Gauteng'       WHERE billing_state ILIKE 'gauteng' OR billing_state ILIKE 'gp';
UPDATE customers SET billing_state = 'Mpumalanga'    WHERE billing_state ILIKE 'mpumalanga' OR billing_state ILIKE 'mp';
UPDATE customers SET billing_state = 'Limpopo'       WHERE billing_state ILIKE 'limpopo' OR billing_state ILIKE 'lp';

-- Suburbs / cities mistakenly stored as state -> map to actual SA province
UPDATE customers SET billing_state = 'Gauteng'
  WHERE billing_country = 'South Africa' AND billing_state IN ('Marshalltown', 'Tulisa Park');

UPDATE customers SET billing_state = 'Mpumalanga'
  WHERE billing_country = 'South Africa' AND billing_state = 'Kriel Rd Kriel Colliery';

-- Mirror to shipping_state with the same rules
UPDATE customers SET shipping_state = 'KwaZulu-Natal'
  WHERE shipping_state ILIKE 'kwazulu-natal' OR shipping_state ILIKE 'kwazulu natal' OR shipping_state ILIKE 'kzn';
UPDATE customers SET shipping_state = 'North West'
  WHERE shipping_state ILIKE 'north-west' OR shipping_state ILIKE 'north west' OR shipping_state ILIKE 'northwest';
UPDATE customers SET shipping_state = 'Eastern Cape' WHERE shipping_state ILIKE 'eastern cape';
UPDATE customers SET shipping_state = 'Western Cape' WHERE shipping_state ILIKE 'western cape';
UPDATE customers SET shipping_state = 'Northern Cape' WHERE shipping_state ILIKE 'northern cape';
UPDATE customers SET shipping_state = 'Free State'    WHERE shipping_state ILIKE 'free state' OR shipping_state ILIKE 'freestate';
UPDATE customers SET shipping_state = 'Gauteng'       WHERE shipping_state ILIKE 'gauteng' OR shipping_state ILIKE 'gp';
UPDATE customers SET shipping_state = 'Mpumalanga'    WHERE shipping_state ILIKE 'mpumalanga' OR shipping_state ILIKE 'mp';
UPDATE customers SET shipping_state = 'Limpopo'       WHERE shipping_state ILIKE 'limpopo' OR shipping_state ILIKE 'lp';
UPDATE customers SET shipping_state = 'Gauteng'
  WHERE billing_country = 'South Africa' AND shipping_state IN ('Marshalltown', 'Tulisa Park');
UPDATE customers SET shipping_state = 'Mpumalanga'
  WHERE billing_country = 'South Africa' AND shipping_state = 'Kriel Rd Kriel Colliery';

COMMIT;

-- Verify
SELECT billing_state, COUNT(*) AS cnt
FROM customers
GROUP BY billing_state
ORDER BY cnt DESC;
