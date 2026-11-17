-- ============================================================
-- STAGING BOOTSTRAP — PROPOSAL ONLY. STAGING SUPABASE ONLY.
-- DO NOT RUN AGAINST PRODUCTION. DO NOT RUN WITHOUT EXPLICIT APPROVAL.
-- ============================================================
-- Purpose: stand up a brand-new, empty staging Supabase project with the
-- exact schema/roles/RPCs/triggers the current frontend and the planned
-- RLS design need — WITHOUT copying any real personnel, customer, or
-- equipment data. This file replaces the earlier "run supabase_setup.sql
-- then TRUNCATE the PII tables" approach: instead, the real-data INSERT
-- blocks are simply never included here in the first place. Nothing to
-- truncate, nothing to accidentally leave behind.
--
-- ----------------------------------------------------------------
-- HOW THIS FILE WAS BUILT (methodology, so it stays auditable/diffable)
-- ----------------------------------------------------------------
-- Every CREATE TABLE / CREATE INDEX / trigger / function / RLS policy
-- statement below was copied VERBATIM (byte-for-byte, via direct file
-- reads, never retyped from memory) from the actual reviewed source files:
--   - supabase_setup.sql   lines 1-372   (tables, indexes, update_timestamp
--                                         trigger, roles + maintenance_types
--                                         seed only)
--   - supabase_setup.sql   lines 2565-2618 (RLS "Allow all" policy block)
--   - audit_triggers.sql   (full file, 79 lines)
--   - add_mfa_tokens_table.sql (full file, 16 lines)
-- The ONLY genuinely NEW text in this file is the "MINIMAL SYNTHETIC
-- REFERENCE DATA" section below (one test category + one test
-- subcategory), clearly marked, written fresh — not copied from
-- production. Real employee-name-adjacent generic branch/site locations
-- and the 190 real customers are DELIBERATELY OMITTED (see classification
-- table below) rather than copied-then-deleted.
--
-- Deliberately NOT duplicated inline (kept as separate, already-reviewed,
-- already schema-only files to run AFTER this one — see the ordered list
-- at the bottom): supabase_migration.sql (756 lines of RPC functions),
-- add_equipment_soft_delete.sql (169 lines), add_current_customer.sql (75
-- lines). These contain zero data and don't need any sanitisation, so
-- copying them here would only add transcription risk for no benefit —
-- running the original, already-audited files is strictly safer.
--
-- ----------------------------------------------------------------
-- CLASSIFICATION OF EVERY STATEMENT IN supabase_setup.sql (as requested)
-- ----------------------------------------------------------------
-- Lines 1-321   SCHEMA                  CREATE TABLE / CREATE INDEX / triggers — copied below verbatim.
-- Lines 322-336 GENERIC REFERENCE SEED  categories (8 rows, WearCheck's actual equipment taxonomy) — NOT copied, see note below.
-- Lines 337-347 GENERIC REFERENCE SEED  subcategories (12 rows) — NOT copied, see note below.
-- Lines 348-356 PRODUCTION-SPECIFIC DATA locations (7 real WearCheck branch office names) — NOT copied.
-- Lines 357-362 GENERIC REFERENCE SEED  roles (3 rows: admin/manager/user) — COPIED VERBATIM, genuinely required + non-personal.
-- Lines 363-367 GENERIC REFERENCE SEED  maintenance_types (7 rows) — COPIED VERBATIM, genuinely required + non-personal.
-- Lines 374-844 REAL PERSONNEL DATA     121 real employees (names/emails) — NOT copied, ever.
-- Lines ~845-855 PRODUCTION-SPECIFIC DATA 25 real customer/mine "Site" locations (e.g. "Samancor - TAS") — NOT copied.
-- Lines ~857-1606 REAL CUSTOMER DATA    190 real customers (names/emails) — NOT copied, ever.
-- Lines ~1607-2560 PRODUCTION EQUIPMENT/CALIBRATION DATA 66 real equipment + calibration_records rows — NOT copied, ever.
-- Lines 2565-2618 SCHEMA (RLS)          ENABLE RLS + "Allow all" policies for all 14 base tables — COPIED VERBATIM.
-- Lines 2619-2621 (trailing comment)    row-count summary comment — not executable SQL, ignored.
--
-- Why categories/subcategories/locations are excluded even though they
-- look "generic": they are WearCheck's actual real-world equipment
-- taxonomy and real branch names, not neutral fixtures. Per your explicit
-- instruction ("do not copy the production category/location/customer
-- datasets unless genuinely required"), the AFS/RLS test plan does not
-- need any specific category/subcategory/location name or count — a
-- single synthetic one is enough (equipment.current_location_id is
-- nullable, so even that is optional). See MINIMAL SYNTHETIC REFERENCE
-- DATA section below.
--
-- Only roles and maintenance_types are copied verbatim: they are the only
-- two "GENERIC REFERENCE SEED" blocks that are (a) not real personal/
-- customer/equipment data, (b) actually depended on by app code — roles
-- specifically by role_id 1/2/3 hardcoded throughout backend/database/*.sql
-- and frontend/src/utils/permissions.js (admin/manager/user).
-- ============================================================

BEGIN;

-- ============================================
-- TABLES
-- (verbatim from supabase_setup.sql lines 1-321)
-- ============================================

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_checkout_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    is_consumable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subcategories
CREATE TABLE IF NOT EXISTS subcategories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_id, name)
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    type VARCHAR(50) DEFAULT 'Site',
    customer_id INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Personnel
CREATE TABLE IF NOT EXISTS personnel (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    job_title VARCHAR(150),
    supervisor VARCHAR(200),
    site VARCHAR(100),
    department VARCHAR(100),
    division VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    customer_number VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    currency_code VARCHAR(10) DEFAULT 'ZAR',
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_country VARCHAR(100),
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_country VARCHAR(100),
    tax_registration_number VARCHAR(50),
    vat_treatment VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255),
    full_name VARCHAR(200),
    password_hash VARCHAR(255),
    role_id INTEGER REFERENCES roles(id) DEFAULT 3,
    personnel_id INTEGER REFERENCES personnel(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    phone VARCHAR(50),
    department VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Equipment
CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    equipment_id VARCHAR(50) NOT NULL UNIQUE,
    equipment_name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    subcategory_id INTEGER REFERENCES subcategories(id),
    manufacturer VARCHAR(200),
    model VARCHAR(200),
    is_serialised BOOLEAN NOT NULL DEFAULT TRUE,
    serial_number VARCHAR(100),
    is_quantity_tracked BOOLEAN NOT NULL DEFAULT FALSE,
    total_quantity INTEGER DEFAULT 1,
    available_quantity INTEGER DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'ea',
    reorder_level INTEGER DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'Available'
        CHECK (status IN ('Available', 'Checked Out', 'In Maintenance', 'Retired')),
    current_location_id INTEGER REFERENCES locations(id),
    current_holder_id INTEGER REFERENCES personnel(id),
    last_action VARCHAR(10) CHECK (last_action IN ('OUT', 'IN', 'ISSUE', 'RESTOCK')),
    last_action_timestamp TIMESTAMPTZ,
    next_maintenance_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_serial ON equipment(serial_number);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category_id);

-- Calibration Records
CREATE TABLE IF NOT EXISTS calibration_records (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    serial_number VARCHAR(100),
    calibration_date DATE,
    expiry_date DATE,
    certificate_number VARCHAR(100),
    calibration_status VARCHAR(30) DEFAULT 'Valid'
        CHECK (calibration_status IN ('Valid', 'Due Soon', 'Expired', 'N/A')),
    calibration_provider VARCHAR(200),
    certificate_file_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calibration_equipment ON calibration_records(equipment_id);
CREATE INDEX IF NOT EXISTS idx_calibration_expiry ON calibration_records(expiry_date);
CREATE INDEX IF NOT EXISTS idx_calibration_status ON calibration_records(calibration_status);
CREATE INDEX IF NOT EXISTS idx_calibration_serial ON calibration_records(serial_number);

-- Equipment Movements
CREATE TABLE IF NOT EXISTS equipment_movements (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    action VARCHAR(10) NOT NULL CHECK (action IN ('OUT', 'IN', 'ISSUE', 'RESTOCK')),
    quantity INTEGER DEFAULT 1,
    location_id INTEGER REFERENCES locations(id),
    personnel_id INTEGER REFERENCES personnel(id),
    customer_id INTEGER REFERENCES customers(id),
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_movements_equipment ON equipment_movements(equipment_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON equipment_movements(created_at DESC);

-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    personnel_id INTEGER NOT NULL REFERENCES personnel(id),
    customer_id INTEGER REFERENCES customers(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    purpose TEXT,
    approved_by VARCHAR(100),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_equipment ON reservations(equipment_id);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(start_date, end_date);

-- Maintenance Types
CREATE TABLE IF NOT EXISTS maintenance_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maintenance Log
CREATE TABLE IF NOT EXISTS maintenance_log (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    maintenance_type_id INTEGER REFERENCES maintenance_types(id),
    maintenance_date DATE,
    completed_date DATE,
    description TEXT,
    performed_by VARCHAR(200),
    external_provider VARCHAR(200),
    cost DECIMAL(10, 2),
    cost_currency VARCHAR(10) DEFAULT 'ZAR',
    downtime_days INTEGER DEFAULT 0,
    next_maintenance_date DATE,
    status VARCHAR(30) DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    work_order_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_equipment ON maintenance_log(equipment_id);

-- Equipment Images
CREATE TABLE IF NOT EXISTS equipment_images (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    filename VARCHAR(500),
    original_filename VARCHAR(500),
    file_path TEXT,
    file_size INTEGER,
    mime_type VARCHAR(100),
    caption TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    uploaded_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_equipment ON equipment_images(equipment_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    user_id INTEGER REFERENCES users(id),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER,
    action VARCHAR(20) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by VARCHAR(100),
    changed_by_name VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at DESC);

-- ============================================
-- TRIGGERS (generic updated_at bump — verbatim)
-- ============================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_equipment_updated ON equipment;
CREATE TRIGGER trg_equipment_updated BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_timestamp();
DROP TRIGGER IF EXISTS trg_personnel_updated ON personnel;
CREATE TRIGGER trg_personnel_updated BEFORE UPDATE ON personnel FOR EACH ROW EXECUTE FUNCTION update_timestamp();
DROP TRIGGER IF EXISTS trg_customers_updated ON customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_timestamp();
DROP TRIGGER IF EXISTS trg_calibration_records_updated ON calibration_records;
CREATE TRIGGER trg_calibration_records_updated BEFORE UPDATE ON calibration_records FOR EACH ROW EXECUTE FUNCTION update_timestamp();
DROP TRIGGER IF EXISTS trg_categories_updated ON categories;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_timestamp();
DROP TRIGGER IF EXISTS trg_subcategories_updated ON subcategories;
CREATE TRIGGER trg_subcategories_updated BEFORE UPDATE ON subcategories FOR EACH ROW EXECUTE FUNCTION update_timestamp();
DROP TRIGGER IF EXISTS trg_locations_updated ON locations;
CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_timestamp();
DROP TRIGGER IF EXISTS trg_reservations_updated ON reservations;
CREATE TRIGGER trg_reservations_updated BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_timestamp();
DROP TRIGGER IF EXISTS trg_maintenance_log_updated ON maintenance_log;
CREATE TRIGGER trg_maintenance_log_updated BEFORE UPDATE ON maintenance_log FOR EACH ROW EXECUTE FUNCTION update_timestamp();
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- GENERIC REFERENCE SEED (verbatim — required, non-personal)
-- ============================================

-- Roles: role_id 1/2/3 are hardcoded throughout backend/database/*.sql and
-- frontend/src/utils/permissions.js (admin/manager/user) — must match exactly.
INSERT INTO roles (id, name, permissions) VALUES
    (1, 'admin', '{"all": true}'),
    (2, 'manager', '{"view": true, "edit": true, "checkout": true, "reports": true}'),
    (3, 'user', '{"view": true, "checkout": true}')
ON CONFLICT (name) DO NOTHING;

-- Maintenance Types: generic reference list, not personal/customer data.
INSERT INTO maintenance_types (name) VALUES
    ('Preventive'), ('Corrective'), ('Calibration'),
    ('Inspection'), ('Cleaning'), ('Software Update'), ('Other')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- MINIMAL SYNTHETIC REFERENCE DATA (NEW — written fresh for this file,
-- NOT copied from production). Only enough for equipment rows to have a
-- valid category_id/subcategory_id (both NOT NULL-ish in practice, though
-- the column itself is nullable, category_id/subcategory_id are how the
-- frontend groups equipment — a real category is expected). Deliberately
-- ONE of each; the AFS/RLS test plan does not care about category names.
-- ============================================
INSERT INTO categories (name, is_checkout_allowed, is_consumable) VALUES
    ('TEST Equipment', TRUE, FALSE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO subcategories (category_id, name)
SELECT id, 'TEST General' FROM categories WHERE name = 'TEST Equipment'
ON CONFLICT (category_id, name) DO NOTHING;

-- Locations intentionally NOT seeded here: equipment.current_location_id
-- and equipment_movements.location_id are both nullable, and the AFS
-- ownership test (current_holder_id) does not depend on location at all.
-- Add a synthetic location later only if a specific test needs one.

-- ============================================
-- MFA TOKENS TABLE
-- (verbatim from add_mfa_tokens_table.sql, full file)
-- ============================================

CREATE TABLE IF NOT EXISTS mfa_tokens (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id  INTEGER     NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    token_hash    TEXT        NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    used          BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_tokens_personnel_id ON mfa_tokens(personnel_id);

-- Deny all direct access from frontend (anon/authenticated roles).
-- Only the Netlify serverless function (using the service role key) can read/write.
ALTER TABLE mfa_tokens ENABLE ROW LEVEL SECURITY;
-- No policies added intentionally = complete denial for non-service roles.

-- ============================================
-- AUDIT TRIGGERS FOR KEY TABLES
-- (verbatim from audit_triggers.sql, full file)
-- ============================================

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
    v_user_name TEXT;
BEGIN
    -- Try to get operator name from Supabase request header
    BEGIN
        v_user_name := (current_setting('request.headers', true)::json->>'x-operator-name');
    EXCEPTION WHEN OTHERS THEN
        v_user_name := NULL;
    END;
    v_user_name := COALESCE(NULLIF(v_user_name, ''), 'System');

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, changed_by_name, created_at)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), v_user_name, v_user_name, NOW());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_by, changed_by_name, created_at)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_user_name, v_user_name, NOW());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, changed_by, changed_by_name, created_at)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), v_user_name, v_user_name, NOW());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_trigger ON equipment;
DROP TRIGGER IF EXISTS audit_trigger ON equipment_movements;
DROP TRIGGER IF EXISTS audit_trigger ON calibration_records;
DROP TRIGGER IF EXISTS audit_trigger ON maintenance_log;
DROP TRIGGER IF EXISTS audit_trigger ON reservations;
DROP TRIGGER IF EXISTS audit_trigger ON categories;
DROP TRIGGER IF EXISTS audit_trigger ON subcategories;
DROP TRIGGER IF EXISTS audit_trigger ON locations;
DROP TRIGGER IF EXISTS audit_trigger ON personnel;
DROP TRIGGER IF EXISTS audit_trigger ON customers;
DROP TRIGGER IF EXISTS audit_trigger ON users;

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON equipment FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON equipment_movements FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON calibration_records FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON maintenance_log FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON reservations FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON categories FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON subcategories FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON locations FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON personnel FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON customers FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- ============================================
-- ROW LEVEL SECURITY & POLICIES
-- (verbatim from supabase_setup.sql lines 2565-2618 — today's baseline
-- "Allow all" policies. The AFS-scoped replacement policies live in
-- rls_afs_design_PROPOSAL.sql and are applied SEPARATELY, later, only
-- after this bootstrap + the synthetic test dataset are confirmed working
-- under today's permissive baseline.)
-- ============================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON categories;
CREATE POLICY "Allow all" ON categories FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON subcategories;
CREATE POLICY "Allow all" ON subcategories FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON locations;
CREATE POLICY "Allow all" ON locations FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON personnel;
CREATE POLICY "Allow all" ON personnel FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON customers;
CREATE POLICY "Allow all" ON customers FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON equipment;
CREATE POLICY "Allow all" ON equipment FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE equipment_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON equipment_movements;
CREATE POLICY "Allow all" ON equipment_movements FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE calibration_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON calibration_records;
CREATE POLICY "Allow all" ON calibration_records FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON reservations;
CREATE POLICY "Allow all" ON reservations FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON notifications;
CREATE POLICY "Allow all" ON notifications FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON audit_log;
CREATE POLICY "Allow all" ON audit_log FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE equipment_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON equipment_images;
CREATE POLICY "Allow all" ON equipment_images FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE maintenance_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON maintenance_log;
CREATE POLICY "Allow all" ON maintenance_log FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE maintenance_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON maintenance_types;
CREATE POLICY "Allow all" ON maintenance_types FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON roles;
CREATE POLICY "Allow all" ON roles FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON users;
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);

COMMIT;

-- ============================================================
-- AFTER THIS FILE: run these EXISTING files, verbatim/unmodified, in
-- this exact order. None of them contain real personnel/customer/
-- equipment data (independently verified — see checkpoint notes) so
-- there is nothing to sanitise; duplicating their contents into this file
-- would only add transcription risk for zero benefit.
-- ============================================================
-- 1. supabase_migration.sql          — create_movement, create_handover,
--                                       get_dashboard, and ~10 reporting
--                                       RPCs. REQUIRED CORE (checkout won't
--                                       work without create_movement).
-- 2. add_equipment_soft_delete.sql   — adds equipment.deleted_at/deleted_by
--                                       + redefines get_dashboard()/reports
--                                       to filter them out. REQUIRED CORE:
--                                       frontend/src/services/api.js already
--                                       does `.is('deleted_at', null)` on
--                                       every equipment query — without this
--                                       column, those queries error outright.
-- 3. add_current_customer.sql       — adds equipment.current_customer_id +
--                                       redefines fn_update_equipment_on_movement
--                                       to populate it. REQUIRED CORE: api.js
--                                       already selects current_customer_id.
--                                       Must run AFTER #1 (redefines a
--                                       function #1 also defines) and AFTER
--                                       #2 (both touch get_dashboard/the
--                                       movement trigger — apply in this
--                                       order so the LAST writer wins with
--                                       the intended combined behaviour).
--
-- OPTIONAL (confirmed zero references in frontend/src/services/api.js —
-- skip unless you specifically need supervisor hierarchy/payment-centre
-- reporting in staging):
--   - add_personnel_supervisor_id.sql
--   - add_personnel_payment_centre.sql
--
-- THEN (staging only, after the above, and only once you're ready):
--   - create_test_accounts_PROPOSAL.sql  — the 4 synthetic personnel +
--     3 synthetic equipment rows (AFS/ARC Test Employee/Manager).
--
-- NOT part of this bootstrap at all (see prior checkpoint for full list):
-- any promote_*/set_managers.sql/fix_*.sql real-employee-specific scripts,
-- any Node.js one-off data scripts, vehicles/cellphones/laptops/software-
-- license/calibration-reminder modules (unrelated feature areas), and
-- rls_afs_design_PROPOSAL.sql (applied separately, later, after this
-- bootstrap + synthetic dataset are confirmed working).
