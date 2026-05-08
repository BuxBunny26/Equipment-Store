-- ============================================================
-- Fix: Recent Movements location not displaying for customer checkouts
-- Run in Supabase SQL Editor for project widwzjnfxhsxzhqrzthy
-- The original query only joined locations; movements to customer
-- sites have customer_id set but location_id = NULL.
-- Fix: also join customers and COALESCE(l.name, cust.display_name).
-- ============================================================

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
               COALESCE(l.name, cust.display_name) AS location,
               p.full_name AS personnel, m.created_at
        FROM equipment_movements m
        JOIN equipment e ON m.equipment_id = e.id
        LEFT JOIN locations l ON m.location_id = l.id
        LEFT JOIN customers cust ON m.customer_id = cust.id
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
