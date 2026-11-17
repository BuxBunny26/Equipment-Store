-- Add an optional "Failed" calibration result.
--
-- Problem: calibration_status is computed purely from expiry_date (see
-- fix_calibration_latest_record_tiebreak.sql / add_calibration_soft_delete.sql), so there is
-- no way to record that an equipment item was actually TESTED and FAILED calibration (out of
-- tolerance) as opposed to simply being overdue for a retest. A failed certificate with a
-- future "next due" date would otherwise show as Valid/Due Soon, silently hiding the failure.
-- Equipment.status is intentionally left untouched here -- whether the item stays in service
-- is an operational decision for people to make, not an automatic side effect of this flag.
--
-- Fix: add an OPTIONAL, non-destructive `failed` flag on calibration_records. Defaults to
-- FALSE for every existing and future row, so normal (passing) calibrations need zero extra
-- admin. When a record is marked failed, it becomes a new, distinct 'Failed' calibration
-- status -- taking priority over the date-based Valid/Due Soon/Expired calculation for that
-- record -- wherever the app surfaces calibration status (Calibration page, Equipment list,
-- Equipment Detail, Dashboard, calibration-due report/exports). The existing certificate
-- upload (calibration-certificates storage bucket) is reused as-is to attach the evidence of
-- the failure; no new upload path is needed.
--
-- Safe to run multiple times.

ALTER TABLE calibration_records
    ADD COLUMN IF NOT EXISTS failed BOOLEAN NOT NULL DEFAULT FALSE;

-- Widen the calibration_status CHECK constraint to allow 'Failed', the same way
-- add_equipment_decommission.sql widens equipment.status: look up whatever the constraint is
-- actually named (don't assume Postgres' default auto-generated name) and drop + recreate it
-- explicitly named.
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

-- Let anon/authenticated set/clear the flag the same way they can already edit the other
-- calibration fields (see the column-scoped GRANT added in add_calibration_soft_delete.sql).
GRANT UPDATE (failed) ON calibration_records TO anon, authenticated;

-- ============================================
-- Recreate the 3 "current calibration status" functions, copied verbatim from
-- add_calibration_soft_delete.sql (the current source of truth -- soft-delete filtering and
-- the calibration_date DESC, created_at DESC, id DESC tiebreak are unchanged) except for one
-- new CASE branch (cr.failed -> 'Failed'), which takes priority over the date-based result.
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
            LEFT JOIN LATERAL (
                SELECT * FROM calibration_records
                WHERE equipment_id = e.id AND deleted_at IS NULL
                ORDER BY calibration_date DESC, created_at DESC, id DESC LIMIT 1
            ) cr ON true
            WHERE c.is_consumable = FALSE
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
                            WHEN cr.failed THEN 'Failed'
                            WHEN cr.expiry_date IS NULL THEN 'N/A'
                            WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
                            WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                            ELSE 'Valid'
                        END AS calibration_status
                    FROM equipment e
                    JOIN categories c ON e.category_id = c.id
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
$$ LANGUAGE plpgsql;

-- ============================================
-- ROLLBACK (re-run to undo this migration)
-- ============================================
-- 1) Restore the 3 functions to their pre-this-migration bodies (identical to
--    add_calibration_soft_delete.sql, i.e. the same tiebreak but WITHOUT the
--    "WHEN cr.failed THEN 'Failed'" / "cal.failed" branches).
-- 2) ALTER TABLE calibration_records DROP CONSTRAINT calibration_records_calibration_status_check;
--    ALTER TABLE calibration_records ADD CONSTRAINT calibration_records_calibration_status_check
--        CHECK (calibration_status IN ('Valid', 'Due Soon', 'Expired', 'N/A'));
--    (only safe once no row has calibration_status = 'Failed')
-- 3) REVOKE UPDATE (failed) ON calibration_records FROM anon, authenticated;
--    ALTER TABLE calibration_records DROP COLUMN failed;
