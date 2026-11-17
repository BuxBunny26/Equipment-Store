-- Add a per-equipment calibration override.
--
-- Previously "does this item need calibration tracking?" could only be set at the whole
-- category level (categories.is_consumable) or the whole subcategory level
-- (subcategories.requires_calibration, see add_subcategory_requires_calibration.sql). This adds
-- a third, most specific level: a single equipment item can be marked
-- "calibration not required" (shows as N/A) without affecting any other item in its
-- category/subcategory.
--
-- Safe to run multiple times.

ALTER TABLE equipment
    ADD COLUMN IF NOT EXISTS requires_calibration BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================
-- get_calibration_management: now also excludes equipment individually flagged
-- requires_calibration = FALSE.
-- ============================================
CREATE OR REPLACE FUNCTION public.get_calibration_management(p_status text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
                AND COALESCE(sub.requires_calibration, TRUE) = TRUE
                AND e.requires_calibration = TRUE
                AND (p_status IS NULL 
                    OR (p_status = 'Not Calibrated' AND cr.id IS NULL)
                    OR (p_status = 'Failed' AND cr.failed)
                    OR (p_status = 'Expired' AND NOT cr.failed AND cr.expiry_date < CURRENT_DATE)
                    OR (p_status = 'Due Soon' AND NOT cr.failed AND cr.expiry_date >= CURRENT_DATE AND cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days')
                    OR (p_status = 'Valid' AND NOT cr.failed AND cr.expiry_date > CURRENT_DATE + INTERVAL '30 days')
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
$function$;

-- ============================================
-- get_calibration_summary: same per-equipment override applied to the status
-- breakdown and the total count.
-- ============================================
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
                        AND COALESCE(subcat.requires_calibration, TRUE) = TRUE
                        AND e.requires_calibration = TRUE
                ) sub
                GROUP BY calibration_status
            ) t
        ), '[]'::jsonb),
        'total', (
            SELECT COUNT(*) FROM equipment e
            JOIN categories c ON e.category_id = c.id
            LEFT JOIN subcategories subcat ON e.subcategory_id = subcat.id
            WHERE c.is_consumable = FALSE
                AND COALESCE(subcat.requires_calibration, TRUE) = TRUE
                AND e.requires_calibration = TRUE
        )
    );
END;
$function$;

-- ============================================
-- get_available_report: same per-equipment override.
-- ============================================
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
                AND COALESCE(s.requires_calibration, TRUE) = TRUE
                AND e.requires_calibration = TRUE
                AND (p_category_id IS NULL OR e.category_id = p_category_id)
            ORDER BY e.equipment_name
        ) t
    ), '[]'::jsonb);
END;
$function$;
