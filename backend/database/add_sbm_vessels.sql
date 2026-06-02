-- Add SBM Offshore vessels (Angola) as customer sites.
-- Run once in Supabase SQL editor.

INSERT INTO customers (customer_number, display_name, billing_country, shipping_country)
VALUES
  ('SBM-MONDO', 'SBM Mondo (Vessel)', 'Angola', 'Angola'),
  ('SBM-SAXI',  'SBM Saxi (Vessel)',  'Angola', 'Angola'),
  ('SBM-NGOMA', 'SBM Ngoma (Vessel)', 'Angola', 'Angola')
ON CONFLICT (customer_number) DO NOTHING;

-- Verify
SELECT id, customer_number, display_name, billing_country
FROM customers
WHERE customer_number LIKE 'SBM-%'
ORDER BY display_name;
