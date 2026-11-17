-- Add subcategory-level calibration exemption.
--
-- Previously, "does this item need calibration tracking?" was decided purely by
-- categories.is_consumable (see get_calibration_management / get_calibration_summary).
-- That is too coarse: a whole category had to be marked as a consumable to be
-- excluded. This adds a dedicated per-subcategory flag so a single subcategory
-- (e.g. MVA Cameras) can be exempted from calibration tracking while other
-- subcategories in the same category still require it.
--
-- Safe to run multiple times.

ALTER TABLE subcategories
    ADD COLUMN IF NOT EXISTS requires_calibration BOOLEAN NOT NULL DEFAULT TRUE;

-- Exempt "Cameras" under MVA (Motion Video Amplification) from calibration tracking.
UPDATE subcategories s
SET requires_calibration = FALSE
FROM categories c
WHERE s.category_id = c.id
    AND LOWER(c.name) = 'mva (motion video amplification)'
    AND LOWER(s.name) = 'cameras';

-- ============================================
-- get_calibration_management: now also excludes items whose subcategory is
-- flagged requires_calibration = FALSE (equipment with no subcategory is kept).
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
-- get_calibration_summary: same subcategory exemption applied to the status
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
        )
    );
END;
$function$;
