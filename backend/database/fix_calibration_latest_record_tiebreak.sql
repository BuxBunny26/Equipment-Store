-- APPLIED AND VERIFIED IN PRODUCTION on 2026-08-24 — this file is now the source of truth for
-- the deployed function bodies. Live-confirmed: get_calibration_management(NULL, NULL,
-- 'B2140140918') returns calibration_record_id=108 (Due Soon, 2026-09-22), and
-- get_available_report(NULL) returns 'Not Calibrated' for zero-record equipment
-- (e.g. B21402248340). Keep this file in sync with production if these functions change again.
--
-- Root cause (Bug B — "Expired" survives after a newer valid calibration is added):
-- get_calibration_management / get_calibration_summary / get_available_report each pick the
-- "current" calibration record per equipment via:
--     LEFT JOIN LATERAL (
--         SELECT * FROM calibration_records WHERE equipment_id = e.id
--         ORDER BY calibration_date DESC LIMIT 1
--     ) cr ON true
-- When two or more calibration_records rows for the same equipment share the exact same
-- calibration_date (confirmed live in production for equipment EQ-B2140140918 / serial
-- B2140140918: the original record, id=56, calibration_date=2025-09-23, expiry_date=2026-01-23,
-- status=Expired; plus newer records added later, also calibration_date=2025-09-23, but
-- expiry_date=2026-09-22, status=Due Soon), "ORDER BY calibration_date DESC" alone has NO
-- deterministic tiebreaker. Postgres is then free to return ANY of the tied rows, so it can
-- (and, confirmed live, does) keep returning the old Expired row even though a newer, corrected
-- calibration record exists for the same equipment.
--
-- Fix: add a deterministic tiebreak, ORDER BY calibration_date DESC, created_at DESC, id DESC,
-- so that when calibration_date ties, the most recently ADDED record always wins. This is purely
-- an ORDER BY change inside each function body — no table/column changes, fully backward
-- compatible (same function signatures/return shapes), safe to CREATE OR REPLACE.
--
-- Also standardizes get_available_report's "no calibration record" case to report
-- 'Not Calibrated' (matching get_calibration_management/get_checked_out_report's existing
-- convention) instead of the previous 'N/A', which conflated "no record at all" with "record
-- exists but has a null expiry_date". This does not change any other function's output.
--
-- Rollback: re-run the previous CREATE OR REPLACE FUNCTION definitions from
-- supabase_migration.sql (get_calibration_management, get_calibration_summary) and
-- add_equipment_soft_delete.sql (get_available_report) — no data was changed, only the
-- ORDER BY/CASE logic inside these three functions.

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
                ORDER BY calibration_date DESC, created_at DESC, id DESC LIMIT 1
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


-- Current deployed version of get_available_report is the one from
-- add_equipment_soft_delete.sql (adds "AND e.deleted_at IS NULL") — preserved here unchanged,
-- only the LATERAL ORDER BY and the "no record" status label are corrected.
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
                SELECT id, expiry_date FROM calibration_records 
                WHERE equipment_id = e.id
                ORDER BY calibration_date DESC, created_at DESC, id DESC LIMIT 1
            ) cal ON true
            WHERE e.status = 'Available' AND c.is_consumable = FALSE AND e.deleted_at IS NULL
                AND (p_category_id IS NULL OR e.category_id = p_category_id)
            ORDER BY e.equipment_name
        ) t
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;
