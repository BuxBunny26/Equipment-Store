-- PRODUCTION CATCH-UP: fixes "column cr.failed does not exist" on the live site.
--
-- Root cause: add_calibration_soft_delete.sql was explicitly marked "NOT APPLIED TO
-- PRODUCTION" (tested locally only), and add_calibration_failed_result.sql builds directly on
-- top of it. At some point production's get_calibration_management / get_calibration_summary /
-- get_available_report functions were updated to reference cr.failed (and, in some cases,
-- deleted_at) without the calibration_records table ever getting the matching columns added --
-- a pre-existing deployment gap between local/dev and production, not a new regression.
--
-- This script is additive and idempotent (every ALTER uses IF NOT EXISTS, every function is
-- CREATE OR REPLACE with the same signature) -- safe to run multiple times and safe regardless
-- of exactly which of these columns/functions already exist on production.
--
-- It also includes the MVA (Motion Video Amplification) -> Cameras calibration exemption
-- (subcategories.requires_calibration) that was previously applied to local only.

-- ============================================
-- 1. Missing calibration_records columns
-- ============================================
ALTER TABLE calibration_records
    ADD COLUMN IF NOT EXISTS failed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER NULL REFERENCES personnel(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS certificate_file_url TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_calibration_records_deleted_at ON calibration_records(deleted_at);

-- Widen the calibration_status CHECK constraint to allow 'Failed' (look up whatever the
-- constraint is actually named -- don't assume Postgres' default auto-generated name).
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT con.conname INTO v_constraint_name
    FROM pg_constraint con
    JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'calibration_records'::regclass
      AND con.contype = 'c'
      AND att.attname = 'calibration_status'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE calibration_records DROP CONSTRAINT %I', v_constraint_name);
    END IF;
END;
$$;

ALTER TABLE calibration_records DROP CONSTRAINT IF EXISTS calibration_records_calibration_status_check;
ALTER TABLE calibration_records ADD CONSTRAINT calibration_records_calibration_status_check
    CHECK (calibration_status IN ('Valid', 'Due Soon', 'Expired', 'N/A', 'Failed'));

-- Let anon/authenticated write these columns the same way they can already edit the other
-- calibration fields (no-op if a broader table-level GRANT UPDATE already covers them).
GRANT UPDATE (failed, certificate_file_url) ON calibration_records TO anon, authenticated;

-- ============================================
-- 2. MVA (Motion Video Amplification) -> Cameras calibration exemption
-- ============================================
ALTER TABLE subcategories
    ADD COLUMN IF NOT EXISTS requires_calibration BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE subcategories s
SET requires_calibration = FALSE
FROM categories c
WHERE s.category_id = c.id
    AND LOWER(c.name) = 'mva (motion video amplification)'
    AND LOWER(s.name) = 'cameras';

-- ============================================
-- 3. Recreate the 3 calibration/report functions (final, local-verified versions)
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
                AND (p_category_id IS NULL OR e.category_id = p_category_id)
            ORDER BY e.equipment_name
        ) t
    ), '[]'::jsonb);
END;
$function$;
