-- Add new checkout sites (customers):
--   - Bumi Armada under country Angola
--   - Roaming under country Mozambique
-- Already applied directly to the live database via the Supabase service
-- role key (see session notes); kept here for the record/reproducibility,
-- following the same pattern as add_sbm_vessels.sql.
-- Safe to run again (idempotent via ON CONFLICT).

INSERT INTO customers (customer_number, display_name, billing_country, shipping_country)
VALUES
  ('BUMI-ARMADA', 'Bumi Armada', 'Angola', 'Angola'),
  ('ROAMING-MZ',  'Roaming',     'Mozambique', 'Mozambique')
ON CONFLICT (customer_number) DO NOTHING;

-- Verify
SELECT id, customer_number, display_name, billing_country
FROM customers
WHERE customer_number IN ('BUMI-ARMADA', 'ROAMING-MZ')
ORDER BY display_name;
