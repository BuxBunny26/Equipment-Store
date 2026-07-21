-- Add Ultrasound category
-- Run this script to insert the Ultrasound equipment category if it does not already exist.

INSERT INTO categories (name, is_checkout_allowed, is_consumable)
SELECT 'Ultrasound', TRUE, FALSE
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE LOWER(name) = 'ultrasound'
);
