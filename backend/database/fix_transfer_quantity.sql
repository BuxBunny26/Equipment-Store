-- Fix: Site-to-site transfers fail with "Insufficient quantity" for
-- quantity-tracked items that are already fully checked out (available = 0).
--
-- Two bugs:
--   1. create_movement() ran the "insufficient quantity" check even when
--      p_is_transfer = TRUE.
--   2. fn_update_equipment_on_movement() decremented available_quantity again
--      on an OUT that is actually a transfer (would push tracked items below 0).
--
-- A transfer keeps the equipment "out" — it just changes the destination.
-- Quantities therefore must NOT change on a transfer.
--
-- Run once in the Supabase SQL editor.

-- 1) Updated create_movement: skip quantity check on transfers.
CREATE OR REPLACE FUNCTION create_movement(
    p_equipment_id INTEGER,
    p_action VARCHAR(10),
    p_quantity INTEGER DEFAULT 1,
    p_location_id INTEGER DEFAULT NULL,
    p_customer_id INTEGER DEFAULT NULL,
    p_personnel_id INTEGER DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_created_by VARCHAR(100) DEFAULT NULL,
    p_is_transfer BOOLEAN DEFAULT FALSE,
    p_expected_checkout_date DATE DEFAULT NULL,
    p_expected_return_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_equipment RECORD;
    v_movement RECORD;
    v_updated_equipment RECORD;
BEGIN
    SELECT e.*, c.is_consumable, c.is_checkout_allowed, c.name as category_name
    INTO v_equipment
    FROM equipment e
    JOIN categories c ON e.category_id = c.id
    WHERE e.id = p_equipment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Equipment not found';
    END IF;

    IF p_action = 'OUT' THEN
        IF v_equipment.is_consumable THEN
            RAISE EXCEPTION 'Cannot check out consumable items. Use ISSUE action instead.';
        END IF;
        IF NOT v_equipment.is_checkout_allowed THEN
            RAISE EXCEPTION 'Checkout is not allowed for category: %', v_equipment.category_name;
        END IF;
        IF v_equipment.status != 'Available' AND NOT p_is_transfer THEN
            RAISE EXCEPTION 'Equipment is not available for checkout. Current status: %', v_equipment.status;
        END IF;
        IF p_is_transfer AND v_equipment.status != 'Checked Out' THEN
            RAISE EXCEPTION 'Equipment must be checked out for a transfer. Current status: %', v_equipment.status;
        END IF;
        -- Skip quantity check on transfers: the units are already out and
        -- stay out; only their destination changes.
        IF NOT p_is_transfer
           AND v_equipment.is_quantity_tracked
           AND p_quantity > v_equipment.available_quantity THEN
            RAISE EXCEPTION 'Insufficient quantity. Requested: %, Available: %', p_quantity, v_equipment.available_quantity;
        END IF;
        IF p_location_id IS NULL AND p_customer_id IS NULL THEN
            RAISE EXCEPTION 'Location or Customer Site is required for check-out';
        END IF;
        IF p_personnel_id IS NULL THEN
            RAISE EXCEPTION 'Personnel is required for check-out';
        END IF;

    ELSIF p_action = 'IN' THEN
        IF v_equipment.is_consumable THEN
            RAISE EXCEPTION 'Cannot check in consumable items.';
        END IF;
        IF NOT v_equipment.is_quantity_tracked AND v_equipment.status != 'Checked Out' THEN
            RAISE EXCEPTION 'Equipment is not checked out. Current status: %', v_equipment.status;
        END IF;
        IF v_equipment.is_quantity_tracked THEN
            IF p_quantity > (v_equipment.total_quantity - v_equipment.available_quantity) THEN
                RAISE EXCEPTION 'Cannot return more than checked out. Max returnable: %',
                    (v_equipment.total_quantity - v_equipment.available_quantity);
            END IF;
        END IF;
        IF p_location_id IS NULL THEN
            RAISE EXCEPTION 'Return location is required';
        END IF;

    ELSIF p_action = 'ISSUE' THEN
        IF NOT v_equipment.is_consumable THEN
            RAISE EXCEPTION 'ISSUE action is only for consumables. Use OUT for equipment.';
        END IF;
        IF p_quantity > v_equipment.available_quantity THEN
            RAISE EXCEPTION 'Insufficient stock. Requested: %, Available: %', p_quantity, v_equipment.available_quantity;
        END IF;

    ELSIF p_action = 'RESTOCK' THEN
        IF NOT v_equipment.is_consumable THEN
            RAISE EXCEPTION 'RESTOCK action is only for consumables.';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid action. Must be one of: OUT, IN, ISSUE, RESTOCK';
    END IF;

    -- Tag transfer movements in notes so the trigger can detect them.
    INSERT INTO equipment_movements (
        equipment_id, action, quantity, location_id, customer_id, personnel_id, notes, created_by,
        expected_checkout_date, expected_return_date
    ) VALUES (
        p_equipment_id, p_action, p_quantity, p_location_id, p_customer_id, p_personnel_id,
        CASE WHEN p_is_transfer
             THEN COALESCE('[TRANSFER] ' || p_notes, '[TRANSFER]')
             ELSE p_notes END,
        p_created_by,
        p_expected_checkout_date, p_expected_return_date
    )
    RETURNING * INTO v_movement;

    SELECT e.*, c.name as category_name, l.name as current_location, p.full_name as current_holder
    INTO v_updated_equipment
    FROM equipment e
    JOIN categories c ON e.category_id = c.id
    LEFT JOIN locations l ON e.current_location_id = l.id
    LEFT JOIN personnel p ON e.current_holder_id = p.id
    WHERE e.id = p_equipment_id;

    RETURN jsonb_build_object(
        'movement', row_to_json(v_movement),
        'equipment', row_to_json(v_updated_equipment)
    );
END;
$$ LANGUAGE plpgsql;


-- 2) Updated trigger: on a transfer (OUT tagged with [TRANSFER]),
--    only update destination/holder, never change quantities or status.
CREATE OR REPLACE FUNCTION fn_update_equipment_on_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_is_transfer BOOLEAN := COALESCE(NEW.notes LIKE '[TRANSFER]%', FALSE);
BEGIN
    IF NEW.action = 'OUT' AND v_is_transfer THEN
        UPDATE equipment SET
            current_location_id = NEW.location_id,
            current_customer_id = NEW.customer_id,
            current_holder_id   = COALESCE(NEW.personnel_id, current_holder_id),
            last_action = 'OUT',
            last_action_timestamp = NEW.created_at
        WHERE id = NEW.equipment_id;

    ELSIF NEW.action = 'OUT' THEN
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
