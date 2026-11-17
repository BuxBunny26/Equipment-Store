-- Add MVA (Motion Video Amplification) category
-- Run this script to insert the MVA equipment category if it does not already exist.

INSERT INTO categories (name, is_checkout_allowed, is_consumable)
SELECT 'MVA (Motion Video Amplification)', TRUE, FALSE
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE LOWER(name) = 'mva (motion video amplification)'
);
