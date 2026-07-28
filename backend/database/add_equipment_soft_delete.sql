-- Soft-delete support for equipment.
-- Lets managers/admins remove equipment that was entered incorrectly while
-- keeping a 30-day recovery window. The row (and all its history - movements,
-- calibration records, reservations, maintenance log) is never hard-deleted,
-- it's just hidden from normal views via deleted_at. All changes are already
-- tracked in audit_log via the existing equipment audit trigger.
-- Safe to run multiple times.

ALTER TABLE equipment
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_equipment_deleted_at ON equipment(deleted_at);

-- ============================================
-- Recreate report/dashboard functions to exclude soft-deleted equipment
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard(p_overdue_days INTEGER DEFAULT 14)
RETURNS JSONB AS $$
DECLARE
    v_total INTEGER;
    v_available INTEGER;
    v_checked_out INTEGER;
    v_overdue INTEGER;
    v_low_stock INTEGER;
    v_total_consumables INTEGER;
    v_recent JSONB;
BEGIN
    SELECT COUNT(*) INTO v_total FROM equipment e JOIN categories c ON e.category_id = c.id WHERE c.is_consumable = FALSE AND e.deleted_at IS NULL;
    SELECT COUNT(*) INTO v_available FROM equipment e JOIN categories c ON e.category_id = c.id WHERE e.status = 'Available' AND c.is_consumable = FALSE AND e.deleted_at IS NULL;
    SELECT COUNT(*) INTO v_checked_out FROM equipment e JOIN categories c ON e.category_id = c.id WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE AND e.deleted_at IS NULL;
    SELECT COUNT(*) INTO v_overdue FROM equipment e JOIN categories c ON e.category_id = c.id 
        WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE AND e.deleted_at IS NULL
        AND e.last_action_timestamp < (CURRENT_TIMESTAMP - (p_overdue_days || ' days')::INTERVAL);
    SELECT COUNT(*) INTO v_low_stock FROM equipment e JOIN categories c ON e.category_id = c.id 
        WHERE c.is_consumable = TRUE AND e.deleted_at IS NULL AND e.available_quantity <= e.reorder_level;
    SELECT COUNT(*) INTO v_total_consumables FROM equipment e JOIN categories c ON e.category_id = c.id WHERE c.is_consumable = TRUE AND e.deleted_at IS NULL;

    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_recent
    FROM (
        SELECT m.id, e.equipment_id, e.equipment_name, m.action, m.quantity,
               COALESCE(l.name, cust.display_name) AS location,
               p.full_name AS personnel, m.created_at
        FROM equipment_movements m
        JOIN equipment e ON m.equipment_id = e.id
        LEFT JOIN locations l ON m.location_id = l.id
        LEFT JOIN customers cust ON m.customer_id = cust.id
        LEFT JOIN personnel p ON m.personnel_id = p.id
        WHERE e.deleted_at IS NULL
        ORDER BY m.created_at DESC LIMIT 10
    ) t;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'total_equipment', v_total,
            'available_equipment', v_available,
            'checked_out_equipment', v_checked_out,
            'overdue_equipment', v_overdue,
            'total_consumables', v_total_consumables,
            'low_stock_consumables', v_low_stock,
            'overdue_threshold_days', p_overdue_days
        ),
        'recent_movements', v_recent
    );
END;
$$ LANGUAGE plpgsql;

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
                e.custom_fields,
                COALESCE(l.name, cust.display_name) AS current_location,
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
            LEFT JOIN customers cust ON e.current_customer_id = cust.id
            LEFT JOIN personnel p ON e.current_holder_id = p.id
            LEFT JOIN LATERAL (
                SELECT em.expected_checkout_date, em.expected_return_date
                FROM equipment_movements em
                WHERE em.equipment_id = e.id AND em.action = 'OUT'
                ORDER BY em.created_at DESC LIMIT 1
            ) latest_mov ON true
            WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE AND e.deleted_at IS NULL
            ORDER BY e.last_action_timestamp ASC
        ) t
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_available_report(p_category_id INTEGER DEFAULT NULL)
RETURNS JSONB AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(row_to_json(t)::jsonb)
        FROM (
            SELECT 
                e.id, e.equipment_id, e.equipment_name,
                c.name AS category, c.is_checkout_allowed,
                s.name AS subcategory,
                e.serial_number,
                e.is_quantity_tracked, e.available_quantity, e.unit,
                l.name AS current_location,
                cal.expiry_date AS calibration_expiry_date,
                CASE 
                    WHEN cal.expiry_date IS NULL THEN 'N/A'
                    WHEN cal.expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN cal.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END AS calibration_status
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            LEFT JOIN LATERAL (
                SELECT expiry_date FROM calibration_records 
                WHERE equipment_id = e.id ORDER BY calibration_date DESC LIMIT 1
            ) cal ON true
            WHERE e.status = 'Available' AND c.is_consumable = FALSE AND e.deleted_at IS NULL
                AND (p_category_id IS NULL OR e.category_id = p_category_id)
            ORDER BY e.equipment_name
        ) t
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_overdue_report(p_overdue_days INTEGER DEFAULT 14)
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'threshold_days', p_overdue_days,
        'items', COALESCE((
            SELECT jsonb_agg(row_to_json(t)::jsonb)
            FROM (
                SELECT 
                    e.id, e.equipment_id, e.equipment_name,
                    c.name AS category, s.name AS subcategory,
                    e.serial_number,
                    l.name AS current_location,
                    p.full_name AS checked_out_to,
                    p.employee_id AS holder_employee_id,
                    p.email AS holder_email,
                    e.last_action_timestamp AS checked_out_at,
                    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - e.last_action_timestamp))::INTEGER AS days_overdue
                FROM equipment e
                JOIN categories c ON e.category_id = c.id
                JOIN subcategories s ON e.subcategory_id = s.id
                LEFT JOIN locations l ON e.current_location_id = l.id
                LEFT JOIN personnel p ON e.current_holder_id = p.id
                WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE AND e.deleted_at IS NULL
                    AND e.last_action_timestamp < (CURRENT_TIMESTAMP - (p_overdue_days || ' days')::INTERVAL)
                ORDER BY e.last_action_timestamp ASC
            ) t
        ), '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;
