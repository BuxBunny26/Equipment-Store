-- ============================================================
-- Add current_customer_id to equipment table
-- Run this in the Supabase SQL Editor for project widwzjnfxhsxzhqrzthy
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE
-- ============================================================

-- 1. Add the column (no-op if already exists)
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS current_customer_id INTEGER REFERENCES customers(id);

-- 2. Backfill from the latest OUT movement for any currently checked-out equipment
--    that has a customer_id but no current_location_id
UPDATE equipment e
SET current_customer_id = m.customer_id
FROM (
    SELECT DISTINCT ON (equipment_id)
        equipment_id, customer_id
    FROM equipment_movements
    WHERE action = 'OUT' AND customer_id IS NOT NULL
    ORDER BY equipment_id, created_at DESC
) m
WHERE e.id = m.equipment_id
  AND e.status = 'Checked Out'
  AND e.current_location_id IS NULL
  AND e.current_customer_id IS NULL;

-- 3. Update the movement trigger to also track current_customer_id
CREATE OR REPLACE FUNCTION fn_update_equipment_on_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.action = 'OUT' THEN
        UPDATE equipment SET
            status = CASE 
                WHEN is_quantity_tracked AND (available_quantity - NEW.quantity) > 0 THEN 'Available'
                ELSE 'Checked Out'
            END,
            current_location_id = NEW.location_id,
            current_customer_id = NEW.customer_id,
            current_holder_id = NEW.personnel_id,
            last_action = 'OUT',
            last_action_timestamp = NEW.created_at,
            available_quantity = CASE 
                WHEN is_quantity_tracked THEN available_quantity - NEW.quantity
                ELSE available_quantity
            END
        WHERE id = NEW.equipment_id;

    ELSIF NEW.action = 'IN' THEN
        UPDATE equipment SET
            status = CASE
                WHEN is_quantity_tracked AND (available_quantity + NEW.quantity) < total_quantity THEN 'Checked Out'
                ELSE 'Available'
            END,
            current_location_id = NEW.location_id,
            current_customer_id = NULL,
            current_holder_id = NULL,
            last_action = 'IN',
            last_action_timestamp = NEW.created_at,
            available_quantity = CASE
                WHEN is_quantity_tracked THEN available_quantity + NEW.quantity
                ELSE available_quantity
            END
        WHERE id = NEW.equipment_id;

    ELSIF NEW.action = 'ISSUE' THEN
        UPDATE equipment SET
            available_quantity = available_quantity - NEW.quantity,
            last_action = 'ISSUE',
            last_action_timestamp = NEW.created_at
        WHERE id = NEW.equipment_id;

    ELSIF NEW.action = 'RESTOCK' THEN
        UPDATE equipment SET
            available_quantity = available_quantity + NEW.quantity,
            total_quantity = total_quantity + NEW.quantity,
            last_action = 'RESTOCK',
            last_action_timestamp = NEW.created_at
        WHERE id = NEW.equipment_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
