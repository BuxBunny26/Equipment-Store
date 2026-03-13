-- ============================================
-- Supabase RPC Functions Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. MOVEMENT TRIGGER (updates equipment state)
--    This trigger fires AFTER INSERT on equipment_movements
-- ============================================

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

DROP TRIGGER IF EXISTS trg_equipment_movement ON equipment_movements;
CREATE TRIGGER trg_equipment_movement
    AFTER INSERT ON equipment_movements
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_equipment_on_movement();


-- ============================================
-- 2. CREATE MOVEMENT (with validation)
-- ============================================

CREATE OR REPLACE FUNCTION create_movement(
    p_equipment_id INTEGER,
    p_action VARCHAR(10),
    p_quantity INTEGER DEFAULT 1,
    p_location_id INTEGER DEFAULT NULL,
    p_customer_id INTEGER DEFAULT NULL,
    p_personnel_id INTEGER DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_created_by VARCHAR(100) DEFAULT NULL,
    p_is_transfer BOOLEAN DEFAULT FALSE
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
        equipment_id, action, quantity, location_id, customer_id, personnel_id, notes, created_by
    ) VALUES (
        p_equipment_id, p_action, p_quantity, p_location_id, p_customer_id, p_personnel_id, p_notes, p_created_by
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


-- ============================================
-- 3. HANDOVER (atomic IN + OUT)
-- ============================================

CREATE OR REPLACE FUNCTION create_handover(
    p_equipment_id INTEGER,
    p_return_location_id INTEGER,
    p_new_personnel_id INTEGER,
    p_new_location_id INTEGER,
    p_notes TEXT DEFAULT NULL,
    p_created_by VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_equipment RECORD;
    v_updated RECORD;
BEGIN
    -- Get equipment with lock
    SELECT e.*, c.is_consumable
    INTO v_equipment
    FROM equipment e
    JOIN categories c ON e.category_id = c.id
    WHERE e.id = p_equipment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Equipment not found';
    END IF;

    IF v_equipment.is_consumable THEN
        RAISE EXCEPTION 'Handover is not applicable to consumables';
    END IF;

    IF v_equipment.status != 'Checked Out' THEN
        RAISE EXCEPTION 'Equipment must be checked out to perform handover';
    END IF;

    -- Step 1: Check IN
    INSERT INTO equipment_movements (equipment_id, action, quantity, location_id, notes, created_by)
    VALUES (p_equipment_id, 'IN', 1, p_return_location_id, 'Handover return: ' || COALESCE(p_notes, ''), p_created_by);

    -- Step 2: Check OUT to new person
    INSERT INTO equipment_movements (equipment_id, action, quantity, location_id, personnel_id, notes, created_by)
    VALUES (p_equipment_id, 'OUT', 1, p_new_location_id, p_new_personnel_id, 'Handover issue: ' || COALESCE(p_notes, ''), p_created_by);

    -- Fetch updated equipment
    SELECT e.*, c.name as category_name, l.name as current_location, p.full_name as current_holder
    INTO v_updated
    FROM equipment e
    JOIN categories c ON e.category_id = c.id
    LEFT JOIN locations l ON e.current_location_id = l.id
    LEFT JOIN personnel p ON e.current_holder_id = p.id
    WHERE e.id = p_equipment_id;

    RETURN jsonb_build_object(
        'message', 'Handover completed successfully',
        'equipment', row_to_json(v_updated)::jsonb
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 4. DASHBOARD SUMMARY
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
    SELECT COUNT(*) INTO v_total FROM equipment e JOIN categories c ON e.category_id = c.id WHERE c.is_consumable = FALSE;
    SELECT COUNT(*) INTO v_available FROM equipment e JOIN categories c ON e.category_id = c.id WHERE e.status = 'Available' AND c.is_consumable = FALSE;
    SELECT COUNT(*) INTO v_checked_out FROM equipment e JOIN categories c ON e.category_id = c.id WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE;
    SELECT COUNT(*) INTO v_overdue FROM equipment e JOIN categories c ON e.category_id = c.id 
        WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE 
        AND e.last_action_timestamp < (CURRENT_TIMESTAMP - (p_overdue_days || ' days')::INTERVAL);
    SELECT COUNT(*) INTO v_low_stock FROM equipment e JOIN categories c ON e.category_id = c.id 
        WHERE c.is_consumable = TRUE AND e.available_quantity <= e.reorder_level;
    SELECT COUNT(*) INTO v_total_consumables FROM equipment e JOIN categories c ON e.category_id = c.id WHERE c.is_consumable = TRUE;

    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_recent
    FROM (
        SELECT m.id, e.equipment_id, e.equipment_name, m.action, m.quantity,
               l.name as location, p.full_name as personnel, m.created_at
        FROM equipment_movements m
        JOIN equipment e ON m.equipment_id = e.id
        LEFT JOIN locations l ON m.location_id = l.id
        LEFT JOIN personnel p ON m.personnel_id = p.id
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


-- ============================================
-- 5. CHECKED OUT REPORT
-- ============================================

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
                CASE 
                    WHEN e.last_action_timestamp < (CURRENT_TIMESTAMP - (p_overdue_days || ' days')::INTERVAL) THEN TRUE 
                    ELSE FALSE 
                END AS is_overdue
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            LEFT JOIN personnel p ON e.current_holder_id = p.id
            WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE
            ORDER BY e.last_action_timestamp ASC
        ) t
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 6. AVAILABLE EQUIPMENT REPORT
-- ============================================

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
            WHERE e.status = 'Available' AND c.is_consumable = FALSE
                AND (p_category_id IS NULL OR e.category_id = p_category_id)
            ORDER BY e.equipment_name
        ) t
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 7. OVERDUE REPORT
-- ============================================

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
                WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE
                    AND e.last_action_timestamp < (CURRENT_TIMESTAMP - (p_overdue_days || ' days')::INTERVAL)
                ORDER BY e.last_action_timestamp ASC
            ) t
        ), '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 8. USAGE STATS REPORT
-- ============================================

CREATE OR REPLACE FUNCTION get_usage_stats(
    p_from_date TIMESTAMP DEFAULT NULL,
    p_to_date TIMESTAMP DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_most_checked_out JSONB;
    v_most_active JSONB;
    v_by_action JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_most_checked_out
    FROM (
        SELECT e.equipment_id, e.equipment_name, COUNT(*) as checkout_count
        FROM equipment_movements m
        JOIN equipment e ON m.equipment_id = e.id
        WHERE m.action = 'OUT'
            AND (p_from_date IS NULL OR m.created_at >= p_from_date)
            AND (p_to_date IS NULL OR m.created_at <= p_to_date)
        GROUP BY e.id, e.equipment_id, e.equipment_name
        ORDER BY checkout_count DESC LIMIT 10
    ) t;

    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_most_active
    FROM (
        SELECT p.employee_id, p.full_name, COUNT(*) as movement_count,
               COUNT(CASE WHEN m.action = 'OUT' THEN 1 END) as checkouts,
               COUNT(CASE WHEN m.action = 'IN' THEN 1 END) as checkins
        FROM equipment_movements m
        JOIN personnel p ON m.personnel_id = p.id
        WHERE m.action IN ('OUT', 'IN')
            AND (p_from_date IS NULL OR m.created_at >= p_from_date)
            AND (p_to_date IS NULL OR m.created_at <= p_to_date)
        GROUP BY p.id, p.employee_id, p.full_name
        ORDER BY movement_count DESC LIMIT 10
    ) t;

    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_by_action
    FROM (
        SELECT action, COUNT(*) as count
        FROM equipment_movements m
        WHERE (p_from_date IS NULL OR m.created_at >= p_from_date)
            AND (p_to_date IS NULL OR m.created_at <= p_to_date)
        GROUP BY action ORDER BY count DESC
    ) t;

    RETURN jsonb_build_object(
        'most_checked_out', v_most_checked_out,
        'most_active_personnel', v_most_active,
        'movements_by_action', v_by_action
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 9. GENERATE NOTIFICATIONS
-- ============================================

CREATE OR REPLACE FUNCTION generate_notifications()
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER := 0;
    v_item RECORD;
BEGIN
    -- Calibration expiry alerts
    FOR v_item IN
        SELECT e.id, e.equipment_id, e.equipment_name,
               cr.expiry_date,
               (cr.expiry_date - CURRENT_DATE) as days_until_expiry
        FROM equipment e
        JOIN (
            SELECT DISTINCT ON (equipment_id) equipment_id, expiry_date
            FROM calibration_records WHERE expiry_date IS NOT NULL
            ORDER BY equipment_id, calibration_date DESC
        ) cr ON e.id = cr.equipment_id
        WHERE cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
            AND cr.expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM notifications 
            WHERE type = 'calibration_expiry' AND reference_type = 'equipment'
              AND reference_id = v_item.id AND DATE(created_at) = CURRENT_DATE
        ) THEN
            INSERT INTO notifications (type, title, message, reference_type, reference_id)
            VALUES (
                'calibration_expiry',
                CASE 
                    WHEN v_item.days_until_expiry < 0 THEN 'Calibration EXPIRED: ' || v_item.equipment_id
                    WHEN v_item.days_until_expiry = 0 THEN 'Calibration expires TODAY: ' || v_item.equipment_id
                    ELSE 'Calibration due soon: ' || v_item.equipment_id
                END,
                v_item.equipment_name || CASE 
                    WHEN v_item.days_until_expiry < 0 THEN ' calibration expired ' || ABS(v_item.days_until_expiry) || ' days ago.'
                    WHEN v_item.days_until_expiry = 0 THEN ' calibration expires today!'
                    ELSE ' calibration expires in ' || v_item.days_until_expiry || ' days.'
                END,
                'equipment',
                v_item.id
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- Overdue checkout alerts
    FOR v_item IN
        SELECT e.id, e.equipment_id, e.equipment_name,
               p.full_name, e.last_action_timestamp,
               (CURRENT_DATE - e.last_action_timestamp::date) as days_out
        FROM equipment e
        LEFT JOIN personnel p ON e.current_holder_id = p.id
        WHERE e.status = 'Checked Out'
            AND e.last_action_timestamp < CURRENT_DATE - INTERVAL '14 days'
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM notifications
            WHERE type = 'overdue_checkout' AND reference_type = 'equipment'
              AND reference_id = v_item.id AND DATE(created_at) = CURRENT_DATE
        ) THEN
            INSERT INTO notifications (type, title, message, reference_type, reference_id)
            VALUES (
                'overdue_checkout',
                'Overdue: ' || v_item.equipment_id,
                v_item.equipment_name || ' has been out for ' || v_item.days_out || ' days with ' || COALESCE(v_item.full_name, 'unknown'),
                'equipment',
                v_item.id
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('notifications_created', v_count);
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 10. CUSTOMER STATS SUMMARY
-- ============================================

CREATE OR REPLACE FUNCTION get_customer_stats()
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT row_to_json(t)::jsonb FROM (
            SELECT 
                COUNT(*) FILTER (WHERE is_active = TRUE) as active_customers,
                COUNT(*) FILTER (WHERE billing_country = 'South Africa' AND is_active = TRUE) as local_customers,
                COUNT(*) FILTER (WHERE billing_country != 'South Africa' AND is_active = TRUE) as overseas_customers,
                COUNT(DISTINCT billing_country) as countries
            FROM customers
        ) t
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 11. AUDIT SUMMARY STATS
-- ============================================

CREATE OR REPLACE FUNCTION get_audit_summary(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
    v_by_action JSONB;
    v_by_table JSONB;
    v_by_user JSONB;
    v_daily JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_by_action
    FROM (SELECT action, COUNT(*) as count FROM audit_log 
          WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
          GROUP BY action ORDER BY count DESC) t;

    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_by_table
    FROM (SELECT table_name, COUNT(*) as count FROM audit_log
          WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
          GROUP BY table_name ORDER BY count DESC LIMIT 10) t;

    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_by_user
    FROM (SELECT changed_by as user_id, COALESCE(changed_by_name, 'System') as user_name, COUNT(*) as count
          FROM audit_log WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
          GROUP BY changed_by, changed_by_name ORDER BY count DESC LIMIT 10) t;

    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_daily
    FROM (SELECT DATE(created_at) as date, COUNT(*) as count FROM audit_log
          WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
          GROUP BY DATE(created_at) ORDER BY date) t;

    RETURN jsonb_build_object(
        'by_action', v_by_action,
        'by_table', v_by_table,
        'by_user', v_by_user,
        'daily_activity', v_daily
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 12. MAINTENANCE SUMMARY
-- ============================================

CREATE OR REPLACE FUNCTION get_maintenance_summary()
RETURNS JSONB AS $$
DECLARE
    v_by_status JSONB;
    v_overdue INTEGER;
    v_due_soon INTEGER;
    v_cost_month NUMERIC;
    v_cost_year NUMERIC;
BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_by_status
    FROM (SELECT status, COUNT(*) as count FROM maintenance_log GROUP BY status) t;

    SELECT COUNT(*) INTO v_overdue FROM equipment 
    WHERE next_maintenance_date IS NOT NULL AND next_maintenance_date < CURRENT_DATE;

    SELECT COUNT(*) INTO v_due_soon FROM equipment
    WHERE next_maintenance_date IS NOT NULL 
      AND next_maintenance_date >= CURRENT_DATE 
      AND next_maintenance_date <= CURRENT_DATE + INTERVAL '30 days';

    SELECT COALESCE(SUM(cost), 0) INTO v_cost_month FROM maintenance_log
    WHERE maintenance_date >= DATE_TRUNC('month', CURRENT_DATE) AND cost IS NOT NULL;

    SELECT COALESCE(SUM(cost), 0) INTO v_cost_year FROM maintenance_log
    WHERE maintenance_date >= DATE_TRUNC('year', CURRENT_DATE) AND cost IS NOT NULL;

    RETURN jsonb_build_object(
        'by_status', v_by_status,
        'overdue', v_overdue,
        'due_soon', v_due_soon,
        'cost_this_month', v_cost_month,
        'cost_this_year', v_cost_year
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 12B. CALIBRATION MANAGEMENT REPORT
-- ============================================

CREATE OR REPLACE FUNCTION get_calibration_management(
    p_status TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(row_to_json(t)::jsonb)
        FROM (
            SELECT 
                e.id AS equipment_id,
                e.equipment_id AS equipment_code,
                e.equipment_name,
                e.serial_number,
                e.manufacturer,
                c.name AS category,
                cr.calibration_date AS last_calibration_date,
                cr.expiry_date AS calibration_expiry_date,
                cr.certificate_number,
                cr.calibration_provider,
                cr.certificate_file_url,
                cr.id AS calibration_record_id,
                CASE 
                    WHEN cr.id IS NULL THEN 'Not Calibrated'
                    WHEN cr.expiry_date IS NULL THEN 'N/A'
                    WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END AS calibration_status,
                CASE 
                    WHEN cr.expiry_date IS NOT NULL THEN 
                        EXTRACT(DAY FROM (cr.expiry_date::timestamp - CURRENT_DATE::timestamp))::INTEGER
                    ELSE NULL
                END AS days_until_expiry
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            LEFT JOIN LATERAL (
                SELECT * FROM calibration_records
                WHERE equipment_id = e.id
                ORDER BY calibration_date DESC LIMIT 1
            ) cr ON true
            WHERE c.is_consumable = FALSE
                AND (p_status IS NULL 
                    OR (p_status = 'Not Calibrated' AND cr.id IS NULL)
                    OR (p_status = 'Expired' AND cr.expiry_date < CURRENT_DATE)
                    OR (p_status = 'Due Soon' AND cr.expiry_date >= CURRENT_DATE AND cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days')
                    OR (p_status = 'Valid' AND cr.expiry_date > CURRENT_DATE + INTERVAL '30 days')
                )
                AND (p_category IS NULL OR c.name = p_category)
                AND (p_search IS NULL 
                    OR e.equipment_name ILIKE '%' || p_search || '%'
                    OR e.serial_number ILIKE '%' || p_search || '%'
                    OR e.manufacturer ILIKE '%' || p_search || '%'
                )
            ORDER BY 
                CASE WHEN cr.id IS NULL THEN 1 ELSE 0 END,
                cr.expiry_date ASC NULLS LAST
        ) t
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION get_calibration_summary()
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'summary', COALESCE((
            SELECT jsonb_agg(row_to_json(t)::jsonb)
            FROM (
                SELECT calibration_status, COUNT(*) as count
                FROM (
                    SELECT 
                        CASE 
                            WHEN cr.id IS NULL THEN 'Not Calibrated'
                            WHEN cr.expiry_date IS NULL THEN 'N/A'
                            WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
                            WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                            ELSE 'Valid'
                        END AS calibration_status
                    FROM equipment e
                    JOIN categories c ON e.category_id = c.id
                    LEFT JOIN LATERAL (
                        SELECT * FROM calibration_records
                        WHERE equipment_id = e.id
                        ORDER BY calibration_date DESC LIMIT 1
                    ) cr ON true
                    WHERE c.is_consumable = FALSE
                ) sub
                GROUP BY calibration_status
            ) t
        ), '[]'::jsonb),
        'total', (SELECT COUNT(*) FROM equipment e JOIN categories c ON e.category_id = c.id WHERE c.is_consumable = FALSE)
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 13. RESERVATION SUMMARY
-- ============================================

CREATE OR REPLACE FUNCTION get_reservation_summary()
RETURNS JSONB AS $$
DECLARE
    v_by_status JSONB;
    v_upcoming INTEGER;
BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_by_status
    FROM (SELECT status, COUNT(*) as count FROM reservations
          WHERE start_date >= CURRENT_DATE - INTERVAL '7 days' GROUP BY status) t;

    SELECT COUNT(*) INTO v_upcoming FROM reservations
    WHERE status IN ('pending', 'approved')
      AND start_date <= CURRENT_DATE + INTERVAL '7 days'
      AND start_date >= CURRENT_DATE;

    RETURN jsonb_build_object(
        'by_status', v_by_status,
        'upcoming_count', v_upcoming
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- STORAGE BUCKETS (run via Supabase Dashboard or API)
-- ============================================
-- Create these buckets in Supabase Dashboard > Storage:
-- 1. "movement-photos" (public)
-- 2. "equipment-images" (public)
-- 3. "calibration-certificates" (public)
