-- Problem 7: soft delete + auditability for calibration_records.
--
-- STATUS: NOT APPLIED TO PRODUCTION. Tested against LOCAL Supabase only
-- (see repo memory / session notes for the exact local verification steps).
--
-- Goal: let a manager/admin remove an incorrect calibration record from normal
-- operational use WITHOUT a hard DELETE, so the row (and its audit_trigger
-- history + certificate reference) is always recoverable, while every
-- "current calibration" query recalculates from the remaining ACTIVE rows only.
--
-- FK choice for deleted_by: personnel.id (NOT users.id). This app's single
-- "who is acting" identity concept everywhere else is personnel — see
-- equipment.current_holder_id, equipment_movements.personnel_id,
-- reservations.personnel_id, personnel.supervisor_id — never users.id. The
-- users table is login/role plumbing, not the acting-identity concept. The
-- existing audit_trigger_fn only ever captures a free-text operator NAME
-- (audit_log.changed_by VARCHAR(100), from the spoofable x-operator-name
-- header), so it cannot supply this FK either; deleted_by is a new, separate,
-- structured field specifically for this feature.
-- ON DELETE SET NULL matches the existing precedent for personnel-id FKs in
-- this schema (personnel.supervisor_id uses the same policy) — losing the
-- "who" attribution on a rare hard personnel-row deletion is preferable to
-- blocking that deletion or cascading into calibration history.
--
-- No other new columns were added. deleted_at/deleted_by/deletion_reason are
-- the minimal set needed to satisfy "active row = deleted_at IS NULL",
-- "deletion reason required by application logic", and "who/when/why" audit
-- questions. A future supersede/correction chain (supersedes_record_id) is
-- explicitly out of scope for this migration.

-- ============================================
-- FORWARD MIGRATION
-- ============================================

ALTER TABLE calibration_records
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER NULL REFERENCES personnel(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL;

-- Every "current status" query below now filters WHERE equipment_id = e.id
-- AND deleted_at IS NULL before applying the existing
-- calibration_date DESC, created_at DESC, id DESC tiebreak — so a soft-deleted
-- record can never be selected as Current, and if ALL records for an
-- equipment are soft-deleted, the LATERAL join returns zero rows and the
-- equipment correctly falls back to 'Not Calibrated' (cr.id IS NULL branch,
-- unchanged from the existing logic — nothing new needed there).
-- Existing rows are unaffected: deleted_at defaults to NULL, so every row
-- that exists today remains "active" automatically, with no backfill needed.

CREATE INDEX IF NOT EXISTS idx_calibration_records_deleted_at ON calibration_records(deleted_at);

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
                WHERE equipment_id = e.id AND deleted_at IS NULL
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
-- SERVER-SIDE AUTHORIZATION FOR SOFT DELETE (added after security review)
-- ============================================
-- FINDING that motivated this section: the original implementation had the
-- FRONTEND (calibrationApi.softDelete in frontend/src/services/api.js) do a
-- direct `supabase.from('calibration_records').update({deleted_at, deleted_by,
-- deletion_reason}).eq('id', id)`. Verified directly against the local DB's
-- actual grants (pg_class.relacl), NOT assumed: the `anon` Postgres role
-- (the ONLY role PostgREST uses here, since no Supabase Auth/JWT session is
-- ever established by this app today — see rls_afs_design_PROPOSAL.sql) has
-- full `arwdDxtm` privileges on calibration_records, and the table's only
-- RLS policy is "Allow all" `USING (true) WITH CHECK (true)`. That means ANY
-- holder of the public anon key (shipped in the frontend bundle, not a
-- secret) could already call the Supabase REST API directly — bypassing the
-- app, the reason requirement, the manager/admin UI gate, and even a hard
-- DELETE — with zero server-side enforcement. A client-side button gate and
-- a client-side reason check (frontend/src/utils/calibrationDelete.js) are
-- real UX affordances but were NOT a security boundary.
--
-- UPDATE (JWT actor identity activated, LOCAL testing only so far): the
-- residual gap above -- "an attacker who has learned or guessed a real
-- manager's personnel_id calling this RPC directly and claiming to be
-- them" -- was reproduced and confirmed exploitable locally, then closed by
-- deriving the actor from auth_personnel_id() (see
-- add_auth_personnel_id_helper.sql) instead of accepting p_personnel_id as
-- a parameter. auth_personnel_id() only ever returns what PostgREST has
-- already cryptographically verified for THIS request's JWT (signed by
-- mfa-verify.js, carrying only the stable personnel_id + standard role
-- claim, never mutable app role/division). A caller with no token, an
-- expired token, or a forged/tampered token gets no identity at all --
-- proven locally: PostgREST rejects a wrong-key-signed token and a
-- same-key-but-edited-payload token with HTTP 401 (PGRST301) before this
-- function ever runs. The mutable admin/manager check below is unchanged --
-- still a live lookup against users/roles/personnel every call, never the
-- token -- only WHO that check runs against is now verified instead of
-- client-supplied. Locally this uses the local Supabase CLI stack's own
-- well-known HS256 dev secret (SUPABASE_JWT_SECRET in frontend/.env,
-- git-ignored, never the production value); production must instead use
-- SUPABASE_JWT_SIGNING_KEY (ES256, asymmetric), which is intentionally NOT
-- configured anywhere yet -- that provisioning step is still pending before
-- this can go to production.

DROP FUNCTION IF EXISTS soft_delete_calibration_record(INTEGER, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION soft_delete_calibration_record(
    p_record_id INTEGER,
    p_reason TEXT
)
RETURNS calibration_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_personnel_id INTEGER;
    v_reason TEXT;
    v_authorized BOOLEAN;
    v_record calibration_records;
BEGIN
    -- The only identity source: whatever PostgREST already verified for
    -- this request's JWT. Never a client parameter, never a cached role.
    v_personnel_id := auth_personnel_id();
    IF v_personnel_id IS NULL THEN
        RAISE EXCEPTION 'Not authorized: no verified caller identity';
    END IF;

    SELECT * INTO v_record FROM calibration_records WHERE id = p_record_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Calibration record % not found', p_record_id;
    END IF;

    IF v_record.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Calibration record % is already deleted', p_record_id;
    END IF;

    v_reason := btrim(COALESCE(p_reason, ''));
    IF v_reason = '' THEN
        RAISE EXCEPTION 'A deletion reason is required';
    END IF;

    -- Live lookup every call -- never trust a cached/client-supplied role
    -- string, and never the token's role claim either. Fails closed: an
    -- inactive user, an inactive personnel row, or a role other than
    -- admin/manager all resolve to NOT authorized. LOWER() matches the
    -- frontend's own role-casing normalization (e.g. Equipment.js calls
    -- .toLowerCase() before comparing) so backend authorization can never
    -- be stricter/looser than the UI due to role-name casing alone.
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN roles r ON r.id = u.role_id
        JOIN personnel p ON p.id = u.personnel_id
        WHERE u.personnel_id = v_personnel_id
          AND u.is_active
          AND p.is_active
          AND LOWER(r.name) IN ('admin', 'manager')
    ) INTO v_authorized;

    IF NOT v_authorized THEN
        RAISE EXCEPTION 'Not authorized: manager or admin role required to delete a calibration record';
    END IF;

    UPDATE calibration_records
    SET deleted_at = NOW(),
        deleted_by = v_personnel_id,
        deletion_reason = v_reason
    WHERE id = p_record_id
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;

REVOKE ALL ON FUNCTION soft_delete_calibration_record(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_calibration_record(INTEGER, TEXT) TO anon, authenticated;

-- Close the direct-table-update/delete bypass found above. Column-scoped so
-- the OTHER legitimate calibration_records writes (calibrationApi.create(),
-- .update(), and the post-upload certificate_file_url patch in api.js) keep
-- working unchanged for anon/authenticated -- only deleted_at/deleted_by/
-- deletion_reason and hard DELETE are removed from the client-reachable
-- roles. The SECURITY DEFINER function above is owned by the migration
-- runner (postgres), which is unaffected by this REVOKE, so it can still
-- write all 3 columns internally after its own checks pass.
REVOKE UPDATE, DELETE ON calibration_records FROM anon, authenticated;
GRANT UPDATE (
    calibration_date, expiry_date, certificate_number, calibration_provider,
    calibration_status, notes, certificate_file_url
) ON calibration_records TO anon, authenticated;

-- ============================================
-- ROLLBACK (re-run to undo this migration)
-- ============================================
-- 1) Restore the 3 functions to their pre-Problem-7 bodies (identical to
--    backend/database/fix_calibration_latest_record_tiebreak.sql, i.e. the
--    same tiebreak but WITHOUT "AND deleted_at IS NULL" in each LATERAL):
--
--      -- paste the 3 CREATE OR REPLACE FUNCTION bodies from
--      -- fix_calibration_latest_record_tiebreak.sql here, unchanged.
--
-- 2) Restore direct-update/delete privileges and drop the RPC (also drop
--    add_auth_personnel_id_helper.sql's auth_personnel_id() if nothing else
--    depends on it -- see that file's own rollback section):
--
--      GRANT UPDATE, DELETE ON calibration_records TO anon, authenticated;
--      DROP FUNCTION IF EXISTS soft_delete_calibration_record(INTEGER, TEXT);
--
-- 3) Then drop the added columns/index (this DISCARDS any soft-delete
--    metadata recorded in the meantime — only run after confirming no
--    soft-deleted rows need to be kept):
--
--      DROP INDEX IF EXISTS idx_calibration_records_deleted_at;
--      ALTER TABLE calibration_records
--          DROP COLUMN IF EXISTS deletion_reason,
--          DROP COLUMN IF EXISTS deleted_by,
--          DROP COLUMN IF EXISTS deleted_at;
