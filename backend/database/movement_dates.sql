-- Movement Dates Migration
-- Run this in Supabase SQL Editor
-- Adds expected checkout and return dates to equipment movements

-- Add date columns
ALTER TABLE equipment_movements ADD COLUMN IF NOT EXISTS expected_checkout_date DATE;
ALTER TABLE equipment_movements ADD COLUMN IF NOT EXISTS expected_return_date DATE;

-- Index for return date (used in overdue checks)
CREATE INDEX IF NOT EXISTS idx_movements_expected_return ON equipment_movements(expected_return_date);

-- Update create_movement function to accept the new date parameters
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
    -- Get equipment with lock
    SELECT e.*, c.is_consumable, c.is_checkout_allowed, c.name as category_name
    INTO v_equipment
    FROM equipment e
    JOIN categories c ON e.category_id = c.id
    WHERE e.id = p_equipment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Equipment not found';
    END IF;

    -- Validate based on action
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
        IF v_equipment.is_quantity_tracked AND p_quantity > v_equipment.available_quantity THEN
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

    -- Insert movement (trigger handles equipment update)
    INSERT INTO equipment_movements (
        equipment_id, action, quantity, location_id, customer_id, personnel_id, notes, created_by,
        expected_checkout_date, expected_return_date
    ) VALUES (
        p_equipment_id, p_action, p_quantity, p_location_id, p_customer_id, p_personnel_id, p_notes, p_created_by,
        p_expected_checkout_date, p_expected_return_date
    )
    RETURNING * INTO v_movement;

    -- Fetch updated equipment
    SELECT e.*, c.name as category_name, l.name as current_location, p.full_name as current_holder
    INTO v_updated_equipment
    FROM equipment e
    JOIN categories c ON e.category_id = c.id
    LEFT JOIN locations l ON e.current_location_id = l.id
    LEFT JOIN personnel p ON e.current_holder_id = p.id
    WHERE e.id = p_equipment_id;

    RETURN jsonb_build_object(
        'movement', row_to_json(v_movement)::jsonb,
        'equipment', row_to_json(v_updated_equipment)::jsonb
    );
END;
$$ LANGUAGE plpgsql;

-- Update checked-out report to include expected dates and smarter overdue logic
CREATE OR REPLACE FUNCTION get_checked_out_report(p_overdue_days INTEGER DEFAULT 14)
RETURNS JSONB AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(row_to_json(t)::jsonb)
        FROM (
            SELECT 
                e.id, e.equipment_id, e.equipment_name,
                c.name AS category, s.name AS subcategory,
                e.serial_number, e.status,
                l.name AS current_location,
                p.full_name AS checked_out_to,
                p.employee_id AS holder_employee_id,
                p.email AS holder_email,
                e.last_action_timestamp AS checked_out_at,
                EXTRACT(DAY FROM (CURRENT_TIMESTAMP - e.last_action_timestamp))::INTEGER AS days_out,
                latest_mov.expected_checkout_date,
                latest_mov.expected_return_date,
                CASE 
                    WHEN latest_mov.expected_return_date IS NOT NULL AND CURRENT_DATE > latest_mov.expected_return_date THEN TRUE
                    WHEN latest_mov.expected_return_date IS NULL AND e.last_action_timestamp < (CURRENT_TIMESTAMP - (p_overdue_days || ' days')::INTERVAL) THEN TRUE 
                    ELSE FALSE 
                END AS is_overdue
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            LEFT JOIN personnel p ON e.current_holder_id = p.id
            LEFT JOIN LATERAL (
                SELECT em.expected_checkout_date, em.expected_return_date
                FROM equipment_movements em
                WHERE em.equipment_id = e.id AND em.action = 'OUT'
                ORDER BY em.created_at DESC LIMIT 1
            ) latest_mov ON true
            WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE
            ORDER BY e.last_action_timestamp ASC
        ) t
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;
