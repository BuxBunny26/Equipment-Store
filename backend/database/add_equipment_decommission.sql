-- ============================================================
-- Admin/Manager Decommission Equipment
-- ============================================================
-- NOT YET APPLIED TO PRODUCTION. Created for review only (2026-09-02).
--
-- Adds a new equipment.status value, 'Decommissioned', plus lifecycle
-- metadata (decommissioned_at/decommissioned_by/decommission_reason). This
-- is a lifecycle state, NOT deletion -- decommissioned equipment stays
-- fully visible/searchable/reportable (unlike deleted_at/deleted_by, which
-- hides a record entirely). Movement history, calibration history, and
-- audit_log are completely untouched by this migration.
--
-- Follows the same verified-JWT-actor pattern already established by
-- add_auth_personnel_id_helper.sql / add_calibration_soft_delete.sql
-- (Problem 7): the acting personnel_id is derived server-side from
-- auth_personnel_id() (never a client-supplied parameter), and the actor's
-- CURRENT role/active status is looked up live from users/roles/personnel
-- on every call -- never cached, never trusted from the JWT's own claims.
--
-- Direct-update bypass protection uses current_user (the ACTIVE role for
-- privilege checks, which Postgres switches to a SECURITY DEFINER
-- function's owner only for the duration of that function's execution --
-- see guard_equipment_decommission_transition() below), NOT a custom GUC/
-- session flag. A session-variable flag (set_config/current_setting) was
-- considered and rejected: distinguishing callers this way would depend on
-- trusting PostgREST's specific per-request statement-batching behaviour
-- rather than PostgreSQL's own role-membership rules, which is a strictly
-- weaker and harder-to-audit guarantee. See the trigger's own comments for
-- the full analysis.
--
-- The trigger, not the column-scoped REVOKE further below, is the real
-- enforced boundary for status/decommissioned_at/decommissioned_by/
-- decommission_reason: application code (equipmentApi.update/bulkUpdate/
-- softDelete in api.js) issues generic direct table UPDATEs for ordinary
-- edits, which only works if anon/authenticated already hold a TABLE-LEVEL
-- UPDATE grant on equipment -- a column-scoped REVOKE cannot remove a
-- separate table-level grant (PostgreSQL ACLs are additive), so it is
-- likely ineffective alone. See the trigger's own comments for the full
-- grant analysis.
--
-- SAME PRODUCTION-READINESS CAVEAT AS PROBLEM 7 (please re-confirm current
-- state -- this repo's own comments, and the fact that no Netlify CLI/env
-- access was available to verify live env vars during this investigation,
-- both indicate SUPABASE_JWT_SIGNING_KEY/SUPABASE_JWT_SECRET are NOT yet
-- configured in production): until one of those is set, auth_personnel_id()
-- returns NULL for every request, so decommission_equipment() will reject
-- EVERY call, including from real Admins/Managers. This fails CLOSED (safe:
-- nobody can decommission anything, rather than everybody being able to),
-- so it is safe to apply this migration ahead of that provisioning step,
-- but the feature will not be usable end-to-end until it's done.
--
-- Safe to run multiple times (idempotent): the CHECK constraint is dropped
-- by discovering its live name dynamically rather than assuming one, all
-- ALTER TABLE ADD COLUMN use IF NOT EXISTS, and all CREATE FUNCTION/TRIGGER
-- use OR REPLACE / DROP IF EXISTS first.

-- ============================================================
-- 1. Status constraint: add 'Decommissioned', preserve all existing values
-- ============================================================
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT con.conname INTO v_constraint_name
    FROM pg_constraint con
    JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'equipment'::regclass
      AND con.contype = 'c'
      AND att.attname = 'status'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE equipment DROP CONSTRAINT %I', v_constraint_name);
    END IF;
END;
$$;

ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_status_check;
ALTER TABLE equipment ADD CONSTRAINT equipment_status_check
    CHECK (status IN ('Available', 'Checked Out', 'In Maintenance', 'Retired', 'Decommissioned'));

-- ============================================================
-- 2. Lifecycle metadata columns
-- ============================================================
ALTER TABLE equipment
    ADD COLUMN IF NOT EXISTS decommissioned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS decommissioned_by INTEGER REFERENCES personnel(id),
    ADD COLUMN IF NOT EXISTS decommission_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_equipment_decommissioned_at ON equipment(decommissioned_at);

-- ============================================================
-- 3. decommission_equipment(p_equipment_id, p_reason) -- the only sanctioned
--    way to transition equipment into 'Decommissioned'.
-- ============================================================
-- Browser payload contains ONLY p_equipment_id/p_reason (see equipmentApi.
-- decommission in api.js, Step 3). Actor identity, role, timestamp and
-- status are ALL derived/assigned here server-side -- never accepted as
-- parameters, so a client cannot spoof decommissioned_by or skip the role
-- check by calling this RPC directly with crafted arguments.
--
-- OWNERSHIP: this function is owned by a DEDICATED, single-purpose NOLOGIN
-- role (equipment_decommission_executor), NOT the shared migration-runner
-- role (typically `postgres` in this project -- see add_calibration_soft_
-- delete.sql's own "owned by the migration runner (postgres)" comment).
-- Reason: `postgres` already owns at least one OTHER SECURITY DEFINER
-- function that fires on every equipment UPDATE -- audit_trigger_fn()
-- (audit_triggers.sql / fix_categories.sql), attached via an AFTER trigger
-- on equipment. If decommission_equipment were also owned by `postgres`,
-- the guard trigger's "current_user = this function's owner" check would
-- really mean "current_user = postgres", which is satisfied by ANY
-- SECURITY DEFINER function sharing that ownership -- today only
-- audit_trigger_fn (which never itself UPDATEs equipment, so no ACTIVE
-- bypass exists yet), but nothing stops a FUTURE postgres-owned function
-- from doing so undetected. A dedicated role that owns nothing else
-- closes this gap structurally: current_user can only ever equal
-- 'equipment_decommission_executor' while THIS specific function's body is
-- executing.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipment_decommission_executor') THEN
        CREATE ROLE equipment_decommission_executor NOLOGIN;
    END IF;
END;
$$;

-- Minimum privileges for the RPC body below to run (traced statement by
-- statement; NOT the app's own anon/authenticated grants, which this role
-- never receives and is never itself granted TO anon/authenticated/any
-- login-capable role):
--   - USAGE on schema public: every referenced object lives there.
--   - EXECUTE on auth_personnel_id(): SECURITY INVOKER, so it runs AS this
--     role when called from inside decommission_equipment; needs its own
--     EXECUTE grant (no table access needed -- it only parses a GUC).
--   - SELECT on personnel/users/roles: the live admin/manager authorization
--     join. FK validation of decommissioned_by REFERENCES personnel(id) is
--     handled internally by Postgres's own RI trigger machinery and does
--     NOT require an additional grant here.
--   - SELECT on equipment (whole table, not column-scoped): both
--     `SELECT * INTO v_equipment ... FOR UPDATE` and `RETURNING *` read
--     every column of the row, not just the ones being changed.
--   - UPDATE on exactly the 5 columns the RPC's own UPDATE statement sets:
--     status, decommissioned_at, decommissioned_by, decommission_reason,
--     updated_at (updated_at is easy to miss -- it's set in the same
--     statement). NOTE: `SELECT ... FOR UPDATE` additionally requires
--     UPDATE privilege on the table per PostgreSQL's locking-clause rules;
--     this migration grants it at column scope first (least privilege) --
--     if the validation test below hits a permission-denied error on the
--     FOR UPDATE lock specifically, grant table-level UPDATE to this role
--     instead (still a minimal-blast-radius change, since the role is
--     NOLOGIN and reachable only through this one SECURITY DEFINER
--     function, unlike widening anon/authenticated's own grants).
-- Trigger execution itself needs no grant to this role: this codebase's
-- own fix_security_warnings.sql already established that revoking EXECUTE
-- on a trigger function from anon/authenticated does not stop it firing --
-- trigger invocation is not gated by the invoking role's EXECUTE privilege.
GRANT USAGE ON SCHEMA public TO equipment_decommission_executor;
GRANT EXECUTE ON FUNCTION auth_personnel_id() TO equipment_decommission_executor;
GRANT SELECT ON personnel, users, roles TO equipment_decommission_executor;
GRANT SELECT ON equipment TO equipment_decommission_executor;
GRANT UPDATE (status, decommissioned_at, decommissioned_by, decommission_reason, updated_at)
    ON equipment TO equipment_decommission_executor;

DROP FUNCTION IF EXISTS decommission_equipment(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION decommission_equipment(
    p_equipment_id INTEGER,
    p_reason TEXT
)
RETURNS equipment
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_personnel_id INTEGER;
    v_reason TEXT;
    v_authorized BOOLEAN;
    v_equipment equipment;
BEGIN
    -- The only identity source: whatever PostgREST already verified for
    -- this request's JWT (see add_auth_personnel_id_helper.sql). Never a
    -- client parameter, never a cached role, never the JWT's own role claim.
    v_personnel_id := auth_personnel_id();
    IF v_personnel_id IS NULL THEN
        RAISE EXCEPTION 'Not authorized: no verified caller identity';
    END IF;

    -- Live lookup every call, matching soft_delete_calibration_record's own
    -- authorization query exactly (same tables, same LOWER() casing
    -- normalization, same fail-closed behaviour for an inactive user,
    -- inactive personnel row, or a role other than admin/manager).
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
        RAISE EXCEPTION 'Not authorized: manager or admin role required to decommission equipment';
    END IF;

    v_reason := btrim(COALESCE(p_reason, ''));
    IF v_reason = '' THEN
        RAISE EXCEPTION 'A reason for decommissioning is required';
    END IF;

    SELECT * INTO v_equipment FROM equipment WHERE id = p_equipment_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Equipment % not found', p_equipment_id;
    END IF;

    IF v_equipment.status = 'Checked Out' THEN
        RAISE EXCEPTION 'This equipment must be checked in before it can be decommissioned.';
    END IF;

    IF v_equipment.status = 'Decommissioned' THEN
        RAISE EXCEPTION 'This equipment is already decommissioned.';
    END IF;

    IF v_equipment.status != 'Available' THEN
        RAISE EXCEPTION 'Only Available equipment can be decommissioned. Current status: %', v_equipment.status;
    END IF;

    -- No session/GUC flag needed here -- guard_equipment_decommission_transition()
    -- below recognises this UPDATE by current_user (this function's owner,
    -- automatically active for the duration of this SECURITY DEFINER call),
    -- not by anything this function has to explicitly set.
    UPDATE equipment
    SET status = 'Decommissioned',
        decommissioned_at = NOW(),
        decommissioned_by = v_personnel_id,
        decommission_reason = v_reason,
        updated_at = NOW()
    WHERE id = p_equipment_id
    RETURNING * INTO v_equipment;

    RETURN v_equipment;
END;
$$;

-- Ownership transfer: makes the dedicated NOLOGIN role above the function's
-- actual owner, so current_user becomes 'equipment_decommission_executor'
-- (not the shared migration-runner role) for the duration of every call --
-- this is what the trigger's dynamic owner lookup resolves to (see section 4).
-- Requires the role running this migration to be a member of (or superuser
-- relative to) both the function's current owner and the new owner -- true
-- for the `postgres` role used to run migrations in this project.
ALTER FUNCTION decommission_equipment(INTEGER, TEXT) OWNER TO equipment_decommission_executor;

-- EXECUTE (callable via the REST API) is NOT itself authorization -- the
-- function's own auth_personnel_id()/live-role checks above are the real
-- gate. Granted to `authenticated` only: mfa-verify.js's signed JWT always
-- sets role: 'authenticated' (hardcoded, never varies by app role -- see
-- that file), so every request with a verified identity already executes
-- as Postgres role `authenticated`; `anon` only ever applies to requests
-- with NO verified JWT at all, for which auth_personnel_id() always
-- returns NULL and the function already rejects unconditionally -- granting
-- `anon` EXECUTE here would add no real capability, only unnecessary
-- exposed surface, so it is deliberately omitted (a departure from
-- soft_delete_calibration_record's anon+authenticated grant, made after
-- inspecting this app's actual JWT role-claim plumbing rather than copying
-- that precedent blindly).
REVOKE ALL ON FUNCTION decommission_equipment(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decommission_equipment(INTEGER, TEXT) TO authenticated;

-- ============================================================
-- 4. Direct-update bypass protection (status + metadata, all 4 lifecycle cases)
-- ============================================================
-- Why not column-level REVOKE on `status` itself (as Problem 7 did for
-- calibration_records.deleted_at/deleted_by/deletion_reason): equipment.
-- status is ALSO written directly by create_movement()/create_handover()
-- (supabase_migration.sql), which are SECURITY INVOKER (no explicit
-- SECURITY clause = INVOKER by default) and run with the CALLER's own
-- privileges. REVOKE UPDATE(status) FROM anon, authenticated would also
-- break every checkout/check-in, since those RPCs would then lose the
-- ability to write status for the exact same reason a direct client update
-- would. A BEFORE UPDATE trigger that only fires on specific OLD/NEW status
-- combinations leaves every other status transition (Available <-> Checked
-- Out, and any future In Maintenance/Retired use) completely unaffected, so
-- checkout/check-in/bulk edit/category edits etc. keep working unchanged.
--
-- IMPORTANT CORRECTION (this migration no longer relies on the column-scoped
-- REVOKE below as an actual deny): equipmentApi.update()/bulkUpdate()/
-- softDelete() in frontend/src/services/api.js all issue a direct, generic
-- `supabase.from('equipment').update(data)` for ordinary edits (arbitrary
-- caller-chosen columns, including deleted_at/deleted_by via softDelete) --
-- this only works today if anon/authenticated already holds a TABLE-LEVEL
-- UPDATE grant on equipment (a single ACL entry covering every column),
-- since the app has no per-field RPC for ordinary edits. PostgreSQL privileges
-- are additive: a table-level UPDATE grant and a column-level UPDATE grant
-- are separate ACL entries, and `REVOKE UPDATE (col) ON t FROM role` only
-- removes/affects a column-level entry for that column -- it cannot revoke
-- a pre-existing table-level grant. So if a table-level UPDATE grant to
-- anon/authenticated exists (which it must, for ordinary equipment editing
-- to work at all today), the column-scoped REVOKE further below is
-- INEFFECTIVE by itself for decommissioned_at/decommissioned_by/
-- decommission_reason -- those columns would remain writable via the
-- table-level grant regardless of the REVOKE. (This was not re-verified
-- with a live `information_schema.role_table_grants`/`has_table_privilege`
-- query against production in this session -- no DB access was available --
-- but the application behaviour above cannot exist unless that table-level
-- grant is present, so this migration no longer treats the REVOKE as the
-- real boundary.) The REVOKE is left in place as a harmless secondary
-- attempt (correct in the hypothetical case where equipment's grants are
-- ever tightened to column-level only), but the TRIGGER below is now the
-- sole enforced boundary for all 4 lifecycle rules, independent of table/
-- column grant state.
--
-- WHY current_user AND NOT A SESSION/GUC FLAG (set_config/current_setting):
-- current_user is the ACTIVE role Postgres uses for privilege checks. It
-- changes in exactly two well-documented ways: (1) an explicit SET ROLE/SET
-- SESSION AUTHORIZATION, which requires the caller's role to already be a
-- MEMBER of the target role (anon/authenticated are members of neither
-- equipment_decommission_executor nor decommission_equipment's owner in
-- general, and cannot grant themselves that membership -- there is no
-- GRANT/ALTER privilege that lets a non-superuser role add itself to
-- another role); and (2) automatically, for the duration of a SECURITY
-- DEFINER function call, where current_user becomes that function's OWNER
-- regardless of who called it, then reverts when the function returns --
-- this applies to everything executed inside the function's body,
-- including statements that fire triggers. So while decommission_equipment()
-- runs, this trigger observes current_user = equipment_decommission_executor;
-- for a direct client PATCH/UPDATE via PostgREST, it observes current_user
-- = anon/authenticated (whatever role PostgREST set for that request).
-- Neither anon nor authenticated can make themselves appear as the
-- dedicated executor role -- this is pure PostgreSQL role/privilege
-- semantics, not an assumption about PostgREST's request-handling internals.
--
-- SHARED-OWNER RISK, INVESTIGATED AND CLOSED: an earlier draft of this
-- migration left decommission_equipment owned by whichever role runs this
-- migration (typically `postgres` in this project). That check would
-- really have meant "current_user is the shared migration-runner role",
-- NOT "specifically decommission_equipment is executing" -- proven
-- concretely by audit_trigger_fn() (audit_triggers.sql / fix_categories.sql),
-- an EXISTING SECURITY DEFINER function in this exact codebase, owned by
-- that same shared role, attached via an AFTER trigger on equipment (so it
-- fires on every equipment UPDATE, including ordinary edits). It does not
-- itself UPDATE equipment (only INSERTs into audit_log), so no bypass
-- exists TODAY -- but nothing in the ownership model would have prevented
-- a FUTURE postgres-owned function from doing so undetected. Section 3
-- above now creates a dedicated, single-purpose NOLOGIN role
-- (equipment_decommission_executor) that owns nothing else in this schema,
-- so current_user can only equal it while this one function's body runs.
--
-- The function owner is still looked up dynamically via pg_proc/
-- regprocedure rather than hardcoding a role name literal -- this now
-- resolves to equipment_decommission_executor (see the ALTER FUNCTION ...
-- OWNER TO in section 3), and stays correct even if that role is ever
-- renamed, since only the CREATE ROLE statement would need to change.
--
-- Four lifecycle rules enforced (exhaustive over OLD.status/NEW.status
-- both being 'Decommissioned' or not):
--   A) OLD != Decommissioned, NEW != Decommissioned (ordinary equipment):
--      decommissioned_at/decommissioned_by/decommission_reason must not
--      change via a direct/generic update. Every other column stays
--      editable (name, description, category, manufacturer, etc.).
--   B) OLD != Decommissioned, NEW = Decommissioned (entering):
--      only allowed when current_user is decommission_equipment's owner;
--      that trusted path may set status + all 3 metadata columns together.
--   C) OLD = Decommissioned, NEW = Decommissioned (already decommissioned):
--      ordinary fields remain editable, but the 3 metadata columns are
--      immutable -- no path (not even the RPC) may change them once set.
--   D) OLD = Decommissioned, NEW != Decommissioned (recommission attempt):
--      rejected unconditionally -- no recommission mechanism exists yet.
--
-- SECURITY INVOKER, DELIBERATELY (the default -- no explicit clause below):
-- this function must observe the current_user of the STATEMENT THAT FIRED
-- IT (anon/authenticated for a direct client UPDATE, or
-- equipment_decommission_executor when invoked from inside
-- decommission_equipment's own UPDATE). If this were marked SECURITY
-- DEFINER, current_user inside it would instead become THIS TRIGGER
-- FUNCTION's own owner for its whole body, destroying the entire
-- current_user distinction rules B/D depend on. Never add a SECURITY
-- DEFINER clause here.
CREATE OR REPLACE FUNCTION guard_equipment_decommission_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_rpc_owner NAME;
    v_metadata_changed BOOLEAN;
BEGIN
    v_metadata_changed :=
        NEW.decommissioned_at IS DISTINCT FROM OLD.decommissioned_at
        OR NEW.decommissioned_by IS DISTINCT FROM OLD.decommissioned_by
        OR NEW.decommission_reason IS DISTINCT FROM OLD.decommission_reason;

    IF OLD.status IS DISTINCT FROM 'Decommissioned' AND NEW.status IS DISTINCT FROM 'Decommissioned' THEN
        -- Rule A
        IF v_metadata_changed THEN
            RAISE EXCEPTION 'decommissioned_at, decommissioned_by, and decommission_reason cannot be modified directly.';
        END IF;

    ELSIF OLD.status IS DISTINCT FROM 'Decommissioned' AND NEW.status = 'Decommissioned' THEN
        -- Rule B
        SELECT rolname INTO v_rpc_owner
        FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
        WHERE p.oid = 'public.decommission_equipment(integer, text)'::regprocedure;

        IF v_rpc_owner IS NULL OR current_user <> v_rpc_owner THEN
            RAISE EXCEPTION 'Direct status transition to Decommissioned is not allowed. Use the decommission_equipment function.';
        END IF;

    ELSIF OLD.status = 'Decommissioned' AND NEW.status = 'Decommissioned' THEN
        -- Rule C
        IF v_metadata_changed THEN
            RAISE EXCEPTION 'decommissioned_at, decommissioned_by, and decommission_reason are immutable once set.';
        END IF;

    ELSE
        -- Rule D: OLD.status = 'Decommissioned' AND NEW.status IS DISTINCT FROM 'Decommissioned'
        RAISE EXCEPTION 'Recommissioning is not supported. Equipment cannot be transitioned out of Decommissioned status.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_equipment_decommission ON equipment;
CREATE TRIGGER trg_guard_equipment_decommission
BEFORE UPDATE ON equipment
FOR EACH ROW
EXECUTE FUNCTION guard_equipment_decommission_transition();

-- Secondary, best-effort layer only (see the long comment above -- this is
-- likely INEFFECTIVE alone if anon/authenticated already has a table-level
-- UPDATE grant on equipment, which application behaviour strongly implies).
-- Left in place in case equipment's grants are ever tightened to
-- column-level, but the trigger above is the real, grant-independent
-- boundary for all 4 rules. Does NOT touch the `status` column's own grant
-- (still needed by create_movement/create_handover), and does NOT touch any
-- other equipment column.
REVOKE UPDATE (decommissioned_at, decommissioned_by, decommission_reason)
    ON equipment FROM anon, authenticated;

-- ============================================================
-- 5. Active/operational report changes -- exclude Decommissioned
-- ============================================================
-- get_available_report (WHERE e.status = 'Available') and
-- get_checked_out_report / get_overdue_report (WHERE e.status = 'Checked
-- Out') already naturally exclude 'Decommissioned' with NO changes needed,
-- since it can never equal either of those literal values. Only v_total
-- below (which previously counted ALL non-deleted, non-consumable
-- equipment regardless of status) needs an explicit exclusion.
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
    SELECT COUNT(*) INTO v_total FROM equipment e JOIN categories c ON e.category_id = c.id
        WHERE c.is_consumable = FALSE AND e.deleted_at IS NULL AND e.status != 'Decommissioned';
    SELECT COUNT(*) INTO v_available FROM equipment e JOIN categories c ON e.category_id = c.id WHERE e.status = 'Available' AND c.is_consumable = FALSE AND e.deleted_at IS NULL;
    SELECT COUNT(*) INTO v_checked_out FROM equipment e JOIN categories c ON e.category_id = c.id WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE AND e.deleted_at IS NULL;
    SELECT COUNT(*) INTO v_overdue FROM equipment e JOIN categories c ON e.category_id = c.id 
        WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE AND e.deleted_at IS NULL
        AND e.last_action_timestamp < (CURRENT_TIMESTAMP - (p_overdue_days || ' days')::INTERVAL);
    SELECT COUNT(*) INTO v_low_stock FROM equipment e JOIN categories c ON e.category_id = c.id 
        WHERE c.is_consumable = TRUE AND e.deleted_at IS NULL AND e.available_quantity <= e.reorder_level;
    SELECT COUNT(*) INTO v_total_consumables FROM equipment e JOIN categories c ON e.category_id = c.id WHERE c.is_consumable = TRUE AND e.deleted_at IS NULL;

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
        WHERE e.deleted_at IS NULL
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

-- get_calibration_management / get_calibration_summary (bodies otherwise
-- unchanged from fix_calibration_latest_record_tiebreak.sql -- same
-- tiebreak ORDER BY, same CASE/status labels) -- only adding
-- "AND e.status != 'Decommissioned'" so decommissioned equipment is no
-- longer presented as an active calibration obligation. Equipment Detail's
-- own Calibration History tab does NOT use these functions (it reads
-- calibration_records directly), so historical certificates/dates for a
-- decommissioned item remain fully visible there, unaffected.
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
                AND e.status != 'Decommissioned'
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
                        AND e.status != 'Decommissioned'
                ) sub
                GROUP BY calibration_status
            ) t
        ), '[]'::jsonb),
        'total', (SELECT COUNT(*) FROM equipment e JOIN categories c ON e.category_id = c.id WHERE c.is_consumable = FALSE AND e.status != 'Decommissioned')
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROLLBACK (re-run to undo this migration)
-- ============================================================
-- 1) DROP TRIGGER IF EXISTS trg_guard_equipment_decommission ON equipment;
--    DROP FUNCTION IF EXISTS guard_equipment_decommission_transition();
--    GRANT UPDATE (decommissioned_at, decommissioned_by, decommission_reason)
--        ON equipment TO anon, authenticated;
--    (No session/GUC state to clean up -- current_user is never persisted.
--    That GRANT only matters if equipment's UPDATE grants are ever narrowed
--    to column-level; if a table-level UPDATE grant remains, it already
--    covers these columns regardless of this GRANT.)
-- 2) DROP FUNCTION IF EXISTS decommission_equipment(INTEGER, TEXT);
--    (Owned by equipment_decommission_executor -- dropping the function
--    does not drop the role. Then, once nothing else depends on it:)
--    DROP OWNED BY equipment_decommission_executor;
--    DROP ROLE IF EXISTS equipment_decommission_executor;
-- 3) Restore get_dashboard/get_calibration_management/get_calibration_summary
--    to the bodies in add_equipment_soft_delete.sql / fix_calibration_latest_record_tiebreak.sql
--    (identical, minus the "e.status != 'Decommissioned'" conditions added here).
-- 4) ALTER TABLE equipment DROP CONSTRAINT equipment_status_check;
--    ALTER TABLE equipment ADD CONSTRAINT equipment_status_check
--        CHECK (status IN ('Available', 'Checked Out', 'In Maintenance', 'Retired'));
--    (Only safe once no row has status = 'Decommissioned'.)
-- 5) ALTER TABLE equipment DROP COLUMN IF EXISTS decommissioned_at,
--        DROP COLUMN IF EXISTS decommissioned_by, DROP COLUMN IF EXISTS decommission_reason;
