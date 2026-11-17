-- Make "N/A" a real, filterable calibration_status instead of silently excluding exempt
-- equipment from the Calibration page entirely.
--
-- Previously, equipment excluded via categories.is_consumable, subcategories.requires_calibration,
-- or equipment.requires_calibration simply never appeared in get_calibration_management /
-- get_calibration_summary / get_available_report -- there was no way to see or filter for
-- "items that never need calibration" (distinct from 'Not Calibrated', which means an item DOES
-- need calibration but has no record yet). This recreates the 3 functions so that exemption is
-- reflected as calibration_status = 'N/A' and included in the results, instead of being dropped
-- from the WHERE clause.
--
-- is_consumable (Consumables category) is intentionally left as a hard exclusion -- that's a
-- separate "this isn't tracked equipment, it's a consumable" concept with its own dedicated
-- Consumables page, not something that belongs in the Calibration page at all.
--
-- To make filtering trivial and bulletproof (no duplicated branch logic to keep in sync), each
-- function now computes calibration_status once in an inner subquery and filters the outer
-- query against that single computed value, rather than re-deriving the same CASE logic a
-- second time inside the WHERE clause.

CREATE OR REPLACE FUNCTION public.get_calibration_management(p_status text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(row_to_json(t)::jsonb)
        FROM (
            SELECT * FROM (
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
                        WHEN NOT (COALESCE(sub.requires_calibration, TRUE) AND e.requires_calibration) THEN 'N/A'
                        WHEN cr.id IS NULL THEN 'Not Calibrated'
                        WHEN cr.failed THEN 'Failed'
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
                LEFT JOIN subcategories sub ON e.subcategory_id = sub.id
                LEFT JOIN LATERAL (
                    SELECT * FROM calibration_records
                    WHERE equipment_id = e.id AND deleted_at IS NULL
                    ORDER BY calibration_date DESC, created_at DESC, id DESC LIMIT 1
                ) cr ON true
                WHERE c.is_consumable = FALSE
                    AND (p_category IS NULL OR c.name = p_category)
                    AND (p_search IS NULL 
                        OR e.equipment_name ILIKE '%' || p_search || '%'
                        OR e.serial_number ILIKE '%' || p_search || '%'
                        OR e.manufacturer ILIKE '%' || p_search || '%'
                    )
            ) base
            WHERE (p_status IS NULL OR base.calibration_status = p_status)
            ORDER BY 
                CASE WHEN base.calibration_record_id IS NULL THEN 1 ELSE 0 END,
                base.calibration_expiry_date ASC NULLS LAST
        ) t
    ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_calibration_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN jsonb_build_object(
        'summary', COALESCE((
            SELECT jsonb_agg(row_to_json(t)::jsonb)
            FROM (
                SELECT calibration_status, COUNT(*) as count
                FROM (
                    SELECT 
                        CASE 
                            WHEN NOT (COALESCE(subcat.requires_calibration, TRUE) AND e.requires_calibration) THEN 'N/A'
                            WHEN cr.id IS NULL THEN 'Not Calibrated'
                            WHEN cr.failed THEN 'Failed'
                            WHEN cr.expiry_date IS NULL THEN 'N/A'
                            WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
                            WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                            ELSE 'Valid'
                        END AS calibration_status
                    FROM equipment e
                    JOIN categories c ON e.category_id = c.id
                    LEFT JOIN subcategories subcat ON e.subcategory_id = subcat.id
                    LEFT JOIN LATERAL (
                        SELECT * FROM calibration_records
                        WHERE equipment_id = e.id AND deleted_at IS NULL
                        ORDER BY calibration_date DESC, created_at DESC, id DESC LIMIT 1
                    ) cr ON true
                    WHERE c.is_consumable = FALSE
                ) sub
                GROUP BY calibration_status
            ) t
        ), '[]'::jsonb),
        'total', (SELECT COUNT(*) FROM equipment e JOIN categories c ON e.category_id = c.id WHERE c.is_consumable = FALSE)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_available_report(p_category_id integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
                    WHEN NOT (COALESCE(s.requires_calibration, TRUE) AND e.requires_calibration) THEN 'N/A'
                    WHEN cal.id IS NULL THEN 'Not Calibrated'
                    WHEN cal.failed THEN 'Failed'
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
                SELECT id, expiry_date, failed FROM calibration_records 
                WHERE equipment_id = e.id AND deleted_at IS NULL
                ORDER BY calibration_date DESC, created_at DESC, id DESC LIMIT 1
            ) cal ON true
            WHERE e.status = 'Available' AND c.is_consumable = FALSE AND e.deleted_at IS NULL
                AND (p_category_id IS NULL OR e.category_id = p_category_id)
            ORDER BY e.equipment_name
        ) t
    ), '[]'::jsonb);
END;
$function$;
