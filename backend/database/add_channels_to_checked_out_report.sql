-- Add custom_fields (e.g. channels for AMS2140 analyzers) to the
-- Checked Out report so the Reports page can show analyzer channels.
-- Run once in the Supabase SQL editor.

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
            WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE
            ORDER BY e.last_action_timestamp ASC
        ) t
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;
