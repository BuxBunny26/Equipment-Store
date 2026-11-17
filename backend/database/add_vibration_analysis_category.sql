-- Add Vibration Analysis category
-- Run this script to insert the Vibration Analysis equipment category if it does not already exist.

INSERT INTO categories (name, is_checkout_allowed, is_consumable)
SELECT 'Vibration Analysis', TRUE, FALSE
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE LOWER(name) = 'vibration analysis'
);
