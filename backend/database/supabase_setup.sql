-- ============================================
-- SUPABASE COMPLETE SETUP SCRIPT
-- Generated: 2026-03-11T12:17:33.027Z
-- 
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- This creates all tables, inserts seed data, and creates RPC functions
-- ============================================

BEGIN;

-- ============================================
-- TABLES
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
-- TRIGGERS
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
-- SEED DATA: Categories
-- ============================================

INSERT INTO categories (name, is_checkout_allowed, is_consumable) VALUES
    ('Vibration Analysis', TRUE, FALSE),
    ('Laser Alignment', TRUE, FALSE),
    ('Thermal Equipment', TRUE, FALSE),
    ('Thermal Camera', TRUE, FALSE),
    ('Motor Circuit Analysis', TRUE, FALSE),
    ('Electrical / electronic test instrumentation', TRUE, FALSE),
    ('Consumables', TRUE, TRUE),
    ('Tools', TRUE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Subcategories
INSERT INTO subcategories (category_id, name) VALUES
    (1, 'Analyzers'), (1, 'Calibrators'),
    (2, 'Alignment Systems'), (2, 'Sensors'),
    (3, 'Thermal Cameras'), (3, 'Accessories'),
    (4, 'Handheld Cameras'),
    (5, 'MCA Testers'),
    (6, 'Multimeters'), (6, 'Signal Generators'),
    (7, 'General'), (8, 'General')
ON CONFLICT (category_id, name) DO NOTHING;

-- Branch locations
INSERT INTO locations (name, description, type) VALUES
    ('WearCheck - Klerkdorp', 'Klerkdorp Branch', 'Branch'),
    ('WearCheck - Longmeadow', 'Longmeadow Head Office Branch', 'Branch'),
    ('WearCheck - Springs', 'Springs Branch', 'Branch'),
    ('WearCheck - Westville', 'Westville Branch', 'Branch'),
    ('WearCheck - Fochville', 'Fochville Branch', 'Branch'),
    ('WearCheck - Rustenburg', 'Rustenburg Branch', 'Branch'),
    ('WearCheck - Krugersdorp', 'Krugersdorp Branch', 'Branch')
ON CONFLICT (name) DO NOTHING;

-- Roles
INSERT INTO roles (id, name, permissions) VALUES
    (1, 'admin', '{"all": true}'),
    (2, 'manager', '{"view": true, "edit": true, "checkout": true, "reports": true}'),
    (3, 'user', '{"view": true, "checkout": true}')
ON CONFLICT (name) DO NOTHING;

-- Maintenance Types
INSERT INTO maintenance_types (name) VALUES
    ('Preventive'), ('Corrective'), ('Calibration'),
    ('Inspection'), ('Cleaning'), ('Software Update'), ('Other')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PERSONNEL DATA (121 employees)
-- ============================================

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC492', 'Adri', 'Ludick', 'Adri Ludick', 'a.ludick@wearcheckRS.com', 'Manager Mechanical', 'Philip Schutte', NULL, 'ARC-NDT', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC383', 'Adriaan Pertus Johannes', 'Bouwer', 'Adriaan Pertus Johannes Bouwer', 'adriaanb@wearcheckrs.com', 'Thermal Manager', 'Louis Peacock', 'KwaZulu Natal', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC094', 'Ailwel Marshall', 'Rasimphi', 'Ailwel Marshall Rasimphi', 'marshallr@wearcheckrs.com', 'Reliability Technician', 'Riaan de Beer', 'Valterra - Waterval', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC105', 'Alexander', 'Outram', 'Alexander Outram', 'alex@wearcheckrs.com', 'Reliability Technologist', 'Micheal Pretorius', 'RBMR and PMR', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC123', 'Allan', 'Stuurman', 'Allan Stuurman', 'allan@wearcheckrs.com', 'Reliability Technologist - Site Suprevisor', 'Peet Peacock', 'Samancor - ECM Tweefontein', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC511', 'Andre', 'Erasmus', 'Andre Erasmus', 'andree@wearcheck.co.za', 'Machinery Inspector / Auditor', 'Johan Stols', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC103', 'Andrew John  Walker', 'Robb', 'Andrew John  Walker Robb', 'andrew@wearcheckRS.com', 'ARC Centre Manager', 'Louis Peacock', 'Remote Centre', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC484', 'Annah Seipone', 'Modutwane', 'Annah Seipone Modutwane', 'annahm@wearcheckrs.com', 'Trainee Inspector B5', 'Londolani Managa', 'Valterra - Mototolo', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC319', 'Annemie', 'Willer', 'Annemie Willer', 'annemie@wearcheckrs.com', 'Divisional Manager', 'Philip Schutte', 'Longmeadow H/O', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC503', 'Antonio', 'Ehrke', 'Antonio Ehrke', 'antonio.ehrke@wearcheckrs.com', 'RCA Inspector', 'Roger Henwood', NULL, 'ARC-RCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC526', 'Arnoldus Johannes', 'van Zyl', 'Arnoldus Johannes van Zyl', 'Arnold@WearCheckRS.com', 'Electrical Inspector', 'Johan Stols', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC114', 'Aubrey', 'Tshabalala', 'Aubrey Tshabalala', 'aubrey@wearcheckRS.com', 'Reliability Technologist', 'Annah Modutwane', 'Valterra - Mototolo', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC380', 'Chicco Fransisco', 'Tivane', 'Chicco Fransisco Tivane', 'chicco@wearcheckrs.com', 'Reliability Technologist', 'Londolani Managa', 'Steelpoort', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC100', 'Chris', 'Mostert', 'Chris Mostert', 'chrism@wearcheckrs.com', 'Reliability Analyst', 'Eddie Pieterse Snr', 'Springs', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC285', 'Christene', 'Smal', 'Christene Smal', 'chrstene@wearcheckrs.com', 'RS Administrator', 'Megan Salzwedel', 'Longmeadow H/O', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC120', 'CJ', 'Woller', 'CJ Woller', 'cj@wearcheckrs.com', 'Reliability Technician', 'Michael Preotrius', 'RBMR and PMR', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC486', 'Colleen', 'Pyper', 'Colleen Pyper', 'colleen.pyper@WearCheckRS.com', 'Admin and Finance Assistant', 'Adri Ludick', NULL, 'AFS', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC528', 'Daniel Greef', 'Meintjies', 'Daniel Greef Meintjies', 'greeffm@wearcheck.co.za', 'Inspector (Lifting and NDT)', 'Adri Ludick', NULL, 'ARC-NDT', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC402', 'Tshegofatsho Daniel', 'Molapo', 'Tshegofatsho Daniel Molapo', 'daniel@wearcheckrs.com', 'Reliability Technologist', 'Annah Modutwane', 'Valterra - Mototolo', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC081', 'David', 'Viljoen', 'David Viljoen', 'David@wearcheckrs.com', 'Precision Maintenance Technologist', 'Peet Peacock', 'Roamer', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC358', 'Deon', 'Gaarkeuken', 'Deon Gaarkeuken', 'deon@wearcheckrs.com', 'ARC Reliability Specialist', 'Andrew Robb', 'Roamer', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC086', 'Desmond', 'Ngomane', 'Desmond Ngomane', 'desmond@wearcheckrs.com', 'Reliability Technologist', 'Annah Modutwane', 'Valterra - Mototolo', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WCN008', 'Dian', 'Leff', 'Dian Leff', 'dian@wearcheckrs.com', 'Reliability Technician', 'Rohan Willer', 'Namibia', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC119', 'Douglas', 'Prout-Jones', 'Douglas Prout-Jones', 'Douglas@WearcheckRS.com', 'Reliability Technician', 'Riaan de Beer', 'Valterra - Waterval', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC122', 'Eben', 'Prinsloo', 'Eben Prinsloo', 'eben@wearcheckrs.com', 'Reliability Technologist', 'Edward Pieterse Jnr', 'Roamer', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC274', 'Edward Frederick IV', 'Pieterse', 'Edward Frederick IV Pieterse', 'edwardfp@wearcheckrs.com', 'Operations Manager', 'Annemie Willer', 'Longmeadow H/O', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC138', 'Edwin Ashley', 'Gibbons', 'Edwin Ashley Gibbons', 'edwin@wearcheckrs.com', 'ARC TC Machinery Inspector', 'Johan Stols', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC488', 'Ethel', 'Mienie', 'Ethel Mienie', 'ethel.mienie@WearCheckRS.com', 'Administration Assistant', 'Adri Ludick', NULL, 'AFS', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC271', 'Edward', 'Pieterse', 'Edward Pieterse', 'epieterse@wearcheckrs.com', 'ARC Reliability Specialist', 'Peet Peacock', 'Springs', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC090', 'Eugene', 'Scheepers', 'Eugene Scheepers', 'eugene@wearcheckrs.com', 'Reliability Technician', 'Francois Pretorius', 'Neopak - Rosslyn', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC497', 'Evert', 'Viljoen', 'Evert Viljoen', 'evertv@wearcheck.co.za', 'Senior Machinery Inspector', 'Adri Ludick', NULL, 'ARC-NDT', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC080', 'Michael Francios', 'Pretorius', 'Michael Francios Pretorius', 'Franciosp@wearcheckRS.com', 'Reliability Analyst', 'Peet Peacock', 'Neopak - Rosslyn', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC287', 'Francois Jacobus', 'van Eeden', 'Francois Jacobus van Eeden', 'francoisve@wearcheckrs.com', 'Condition Monitoring Specialist', 'Andrew Robb', 'Remote Centre', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC111', 'Jozua Francois Joubert', 'Pienaar', 'Jozua Francois Joubert Pienaar', 'francoisp@wearcheckrs.com', 'Reliability Analyst', 'Peet Peacock', 'KwaZulu Natal - Hillside', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WCN004', 'Freddy-Ben', 'Gariseb', 'Freddy-Ben Gariseb', 'Freddy-Ben@wearcheckRS.com', 'Reliability Technician', 'Rohan Willer', 'Namibia', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WCN007', 'Gabriel Shikongo', 'Nuunyango', 'Gabriel Shikongo Nuunyango', 'gabriel@wearcheckrs.com', 'Reliability Technician', 'Rohan Willer', 'Namibia', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC510', 'Godfrey', 'Boikhutso', 'Godfrey Boikhutso', 'godfreyb@wearcheck.co.za', 'Inspector', 'Johan Stols', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC093', 'Gordon John Frederick', 'Hoy', 'Gordon John Frederick Hoy', 'freddieh@wearcheck.co.za', 'Mechanical Technician', 'Adri Ludick', NULL, 'AFS', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC270', 'Gustav', 'Lourens', 'Gustav Lourens', 'gustav@wearcheckrs.com', 'Reliability Technologist', 'Eddie Pieterse Snr', 'Springs', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC047', 'Hannest', 'Koegelenberg', 'Hannest Koegelenberg', 'hannest@wearcheckrs.com', 'Reliability Technologist', 'Eddie Pieterse Snr', 'Springs', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC129', 'Hein', 'Coetzer', 'Hein Coetzer', 'heinc@wearcheckrs.com', 'Precision Maintenance Technologist', 'Peet Peacock', 'Samancor - TAS', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC134', 'Fritz', 'Kusel', 'Fritz Kusel', 'heinrich@wearcheckrs.com', 'RCA Technician', 'Roger Henwood', NULL, 'ARC-RCA', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC098', 'Henry', 'Mherekumombe', 'Henry Mherekumombe', 'henry@wearcheckrs.com', 'Level 2 Inspector', 'Adri Ludick', NULL, 'ARC-NDT', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC493', 'Jacobus Frederick', 'Venter', 'Jacobus Frederick Venter', 'jacov@wearcheck.co.za', 'Senior Machinery Inspector', 'Adri Ludick', NULL, 'ARC-NDT', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC352', 'Jacobus Johannes', 'Willer', 'Jacobus Johannes Willer', 'jaco@wearcheckrs.com', 'Foreign Operations Business Unit Manager', 'Philip Schutte', 'Longmeadow H/O', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC097', 'Theunis Gerhardus Jacobus', 'de Beer', 'Theunis Gerhardus Jacobus de Beer', 'jacodb@wearcheckrs.com', 'Reliability Technologist', 'Eben Prinsloo', 'Roamer', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC236', 'James Papayito', 'Tshabalala', 'James Papayito Tshabalala', 'james@WearCheckRS.com', 'Reliability Technologist', 'Annah Modutwane', 'Valterra - Mototolo', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC496', 'Jan', 'Booysens', 'Jan Booysens', 'janb@wearcheck.co.za', 'Senior Machinery Inspector', 'Adri Ludick', NULL, 'ARC-NDT', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC494', 'Johann', 'Louw', 'Johann Louw', 'janniel@wearcheck.co.za', 'Inspector', 'Adri Ludick', NULL, 'ARC-NDT', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC137', 'Jean Jacques', 'de Beer', 'Jean Jacques de Beer', 'jj@wearcheckrs.com', 'Technical Advisor', 'Andrew Robb', 'Remote Centre', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC645', 'Johan', 'Bekker', 'Johan Bekker', 'JohanB@wearcheckRS.com', 'ARC TC Inspector', 'Johan Stols', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC491', 'Johan', 'Rossouw', 'Johan Rossouw', 'johanr@wearcheckrs.com', 'Senior Inspector', 'Johan Stols', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC508', 'Johannes Gideon Francios', 'Stols', 'Johannes Gideon Francios Stols', 'Johans@wearcheckrs.com', 'ARC TC Manager', 'Philip Schutte', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC089', 'Johannes Andreas', 'Oosthuizen', 'Johannes Andreas Oosthuizen', 'johandre@wearcheckrs.com', 'Reliability Technician', NULL, 'Samancor - Mooinooi', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC531', 'Joseph Benjamin', 'Kies', 'Joseph Benjamin Kies', 'josephk@wearcheck.co.za', 'Machinery Inspector', 'Johan Stols', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC527', 'Jean-Pierre', 'Jordaan', 'Jean-Pierre Jordaan', 'jeanj@wearcheck.co.za', 'Inspector (Lifting and NDT)', 'Adri Ludick', NULL, 'ARC-NDT', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC135', 'Kevin', 'Henwood', 'Kevin Henwood', 'kevin@wearcheckrs.com', 'RCA Technician', 'Roger Henwood', NULL, 'ARC-RCA', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC482', 'Khotso Thabo', 'Mosala', 'Khotso Thabo Mosala', 'khotso@wearcheckrs.com', 'Inspector', 'Johan Stols', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC455', 'Leon', 'Coetzee', 'Leon Coetzee', 'Leon@wearcheckrs.com', 'Reliability Technologist', 'Londolani Managa', 'Steelpoort', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC126', 'Lesego', 'Khuthwane', 'Lesego Khuthwane', 'Lesego@WearCheckRS.com', 'Remote Centre Administrator', 'Andrew Robb', 'Longmeadow H/O', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC495', 'Lorraine Lerato', 'Mokgethi', 'Lorraine Lerato Mokgethi', 'lorrainem@wearcheck.co.za', 'Technician', 'Adri Ludick', NULL, 'ARC-NDT', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC648', 'Londolani', 'Managa', 'Londolani Managa', 'londolanim@wearcheckrs.com', 'Precision Maintenance Technologist', 'Peet Peacock', 'Samancor - MFC', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC269', 'Bernard Lopi', 'Molangoane', 'Bernard Lopi Molangoane', 'lopim@wearcheck.co.za', 'Sampler', 'Annah Modutwane', 'Valterra - Mototolo', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC277', 'Louis Robert', 'Peacock', 'Louis Robert Peacock', 'louis@wearcheckrs.com', 'Technical & Training Manager', 'Annemie Willer', 'Longmeadow H/O', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC118', 'Labby Jeffrey', 'Lubis', 'Labby Jeffrey Lubis', 'lubby@wearcheckrs.com', 'Reliability Technologist - Site Suprevisor', 'Peet Peacock', 'Samancor - Doornbosch', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC068', 'Lucas Johannes Bartel', 'Luus', 'Lucas Johannes Bartel Luus', 'lucas@wearcheckrs.com', 'Reliability Technician', 'Andrew Robb', 'Kathu', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC116', 'Mande', 'Coetzee', 'Mande Coetzee', 'mande@wearcheckrs.com', 'RS Administrator', 'Shivon Alberts', 'Longmeadow H/O', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC102', 'Marcel', 'Schoeman', 'Marcel Schoeman', 'marcel@wearcheckrs.com', 'Sales Manager', 'Annemie Willer', 'Roamer', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC109', 'Mariette', 'du Rand', 'Mariette du Rand', 'mariette@wearcheckrs.com', 'RS Administrator', 'Megan Salzwedel', 'Longmeadow H/O', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC106', 'Marthinus Jacobus', 'van Aarde', 'Marthinus Jacobus van Aarde', 'martiens@wearcheckrs.com', 'Reliability Technician', 'Tsietsi Monnanyne', 'Eskom - Matimba', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC483', 'Mike Mbongeni', 'Shongwe', 'Mike Mbongeni Shongwe', 'mikes@weacheckrs.com', 'Senior Inspector', 'Adri Ludick', NULL, 'ARC-NDT', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC104', 'Megan', 'Salzwedel', 'Megan Salzwedel', 'megan@wearcheckrs.com', 'Administration Manager', 'Edward Pieterse Jnr', 'Longmeadow H/O', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC536', 'Mervyn Thomas', 'Gibbons', 'Mervyn Thomas Gibbons', 'mervyng@wearcheck.co.za', 'ARC TC Machinery Inspector', 'Johan Stols', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC088', 'Meshack Welcome', 'Nxumalo', 'Meshack Welcome Nxumalo', 'meshack@wearcheckrs.com', 'Reliability Technologist', 'Francois Pienaar', 'KwaZulu Natal', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC076', 'Micheal Francios', 'Pretorius', 'Micheal Francios Pretorius', 'micheal@wearcheckrs.com', 'Reliability Analyst - Site Supervisor', 'Peet Peacock', 'RBMR and PMR', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC291', 'Seporo Micheal', 'Masemola', 'Seporo Micheal Masemola', 'michealm@wearcheckrs.com', 'Reliability Technologist', 'Annah Modutwane', 'Valterra - Mototolo', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC465', 'Mmatapa Betty', 'Monyepao', 'Mmatapa Betty Monyepao', 'betty@wearcheckrs.com', 'Reliability Technician', 'Annah Modutwane', 'Valterra - Mototolo', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC361', 'Morne', 'Alberts', 'Morne Alberts', 'mornea@wearcheckrs.com', 'ARC Reliability Specialist', 'Andrew Robb', 'Remote Centre', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC113', 'Nadhira', 'Bux', 'Nadhira Bux', 'nadhira@wearcheckrs.com', 'Integration Co-Ordinator', 'Louis Peacock', 'Longmeadow H/O', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC506', 'Nicolaas', 'du Plessis', 'Nicolaas du Plessis', 'nico.duplessis@wearcheckrs.com', 'RCA Inspector', 'Roger Henwood', NULL, 'ARC-RCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC099', 'Lloyd', 'Ngobeni', 'Lloyd Ngobeni', 'lloyd@wearcheckrs.com', 'Precision Maintenance Technologist', 'Riaan de Beer', 'Valterra - Waterval', 'ARC-NDT', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC651', 'Nomvula', 'Mkhize', 'Nomvula Mkhize', 'nomvulam@wearcheckrs.com', 'Precision Maintenance Technologist', 'Peet Peacock', 'Samancor - MFC', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC509', 'Norman Landus', 'Walters', 'Norman Landus Walters', 'Landus@wearcheckrs.com', 'Machinery Inspector', 'Johan Stols', NULL, 'ARC-TCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC348', 'Putaneng Paswell', 'Mashoeu', 'Putaneng Paswell Mashoeu', 'passwell@wearcheckrs.com', 'Sampler', 'Annah Modutwane', 'Valterra - Mototolo', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC498', 'Patrick', 'Nel', 'Patrick Nel', 'patrick@wearcheckrs.com', 'Machinery Inspector', 'Adri Ludick', NULL, 'ARC-NDT', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC520', 'Petrus Johannes', 'Peacock', 'Petrus Johannes Peacock', 'Peet@wearcheckrs.com', 'Service Manager', 'Annemie Willer', NULL, 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC115', 'Percy', 'Hall', 'Percy Hall', 'percy@wearcheckrs.com', 'Reliability Technologist', 'Londolani Managa', 'Seriti - Khutala', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC393', 'Katishi Permission', 'Malele', 'Katishi Permission Malele', 'permission@wearcheckrs.com', 'Sampler', 'Annah Modutwane', 'Valterra - Mototolo', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC253', 'Philippus Jacobus Wilhelmus (Philip)', 'Schutte', 'Philippus Jacobus Wilhelmus (Philip) Schutte', 'philip@wearcheckrs.com', 'General Manager', 'N/A', 'Longmeadow H/O', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC382', 'Reinier', 'Kalp', 'Reinier Kalp', 'reinierk@wearcheckrs.com', 'Remote Center Analyst', 'Andrew Robb', 'Remote Centre', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC591', 'Adriaan Johannes', 'du Plooy', 'Adriaan Johannes du Plooy', 'Riaandp@wearcheckRS.com', 'Country Manager', 'Jaco Willer', 'Mozambique', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC363', 'Riaan', 'de Beer', 'Riaan de Beer', 'riaandb@wearcheckrs.com', 'Supervisor', 'Peet Peacock', 'Valterra - Waterval', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC507', 'Richard', 'van Vuuren', 'Richard van Vuuren', NULL, NULL, 'Adri Ludick', NULL, NULL, 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC504', 'Roger', 'Henwood', 'Roger Henwood', 'rogerh@wearcheckrs.com', 'RCA Operations Manager', 'Philip Schutte', NULL, 'ARC-RCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC074', 'Rakcal Monroe', 'Balaram', 'Rakcal Monroe Balaram', 'rakcal@wearcheckrs.com', 'Reliability Technologist', 'Francois Pienaar', 'KwaZulu Natal - Tronox', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC381', 'Hermanus Johannes', 'Willer', 'Hermanus Johannes Willer', 'rohan@wearcheckrs.com', 'Site Manager', 'Jaco Willer', 'Namibia', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC096', 'Rynhardt', 'Meyer', 'Rynhardt Meyer', 'rynhardt@wearcheckrs.com', 'Precision Maintenance Technologist', 'Riaan de Beer', 'Valterra - Waterval', 'ARC-NDT', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC501', 'Rynhardt', 'Smit', 'Rynhardt Smit', 'rynhardt.smit@wearcheckrs.com', 'RCA Inspector', 'Roger Henwood', NULL, 'ARC-RCA', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC264', 'Sergant Sakhile', 'Tlou', 'Sergant Sakhile Tlou', 'sergent@wearcheckrs.com', 'Reliability Technologist', 'Eben Prinsloo', 'Roamer', 'ARC-RCM', 'Wearcheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC136', 'Shaun', 'Janse van Rensburg', 'Shaun Janse van Rensburg', 'shaun@wearcheckrs.com', 'Machinery Inspector', 'Johan Stols', NULL, 'ARC-TCA', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC130', 'Shivon Chantelle', 'Alberts', 'Shivon Chantelle Alberts', 'shivon@wearcheckrs.com', 'Financial Manager', 'Megan Salzwedel', 'Longmeadow H/O', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC283', 'Mokale Simon', 'Mosima', 'Mokale Simon Mosima', 'simon@wearcheckrs.com', 'Reliability Technician', 'Tsietsi Monnanyne', 'Eskom - Matimba', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC485', 'Simon Petrus', 'Difutso', 'Simon Petrus Difutso', 'simondifutso@WearCheckRS.com', 'AMM Junior Management', 'Adri Ludick', NULL, 'ARC-NDT', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC360', 'Sipho Petros', 'Zwane', 'Sipho Petros Zwane', 'siphoz@wearcheckrs.com', 'Reliability Analyst', 'Francois Pienaar', 'KwaZulu Natal - Hillside', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC039', 'Sipho Petros', 'Mathibela', 'Sipho Petros Mathibela', 'siphom@wearcheckrs.com', 'Reliability Technician', 'Londolani Managa', 'Samancor - MFC', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC487', 'Teresa', 'Venter', 'Teresa Venter', 'teresa.venter@wearcheckRS.com', 'Administration Assistant', 'Adri Ludick', NULL, 'AFS', 'AFS')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC132', 'Thapelo Pebetsi', 'Mohlala', 'Thapelo Pebetsi Mohlala', 'Thapelo@wearCheckRS.com', 'Reliability Technologist Trainee', 'Allan Stuurman / Lubby Lubis', 'Samancor Tweefontein / Samancor Doornbosch', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WC243', 'Thomas', 'Mdhlala', 'Thomas Mdhlala', 'Thomas@wearcheckrs.com', 'Reliability Technologist', 'Michael Preotrius', 'PMR', 'ARC-RCM', 'WearCheck')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC062', 'Thulani', 'Tembe', 'Thulani Tembe', 'thulani@wearcheckrs.com', 'Precision Maintenance Technologist', 'Peet Peacock', 'Samancor - Millcell', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC057', 'Tonny', 'Simelani', 'Tonny Simelani', 'tonny@wearcheckrs.com', 'Reliability Technologist', 'Eddie Pieterse Snr', 'Springs', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC133', 'Tsietsi Petric', 'Monnanyane', 'Tsietsi Petric Monnanyane', 'tsietsi@wearcheckrs.com', 'Precision Maintenance Technologist', 'Peet Peacock', 'Eskom - Matimba', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC124', 'Vernon', 'Calvert', 'Vernon Calvert', 'vernon@wearcheckrs.com', 'Reliability Technician', 'Riaan de Beer', 'Valterra - Waterval', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
VALUES ('WEC127', 'Wihan Manu', 'Willer', 'Wihan Manu Willer', 'wihan@wearcheckRS.com', 'Reliability Technician', 'Francois Pretorius', 'Neopak - Rosslyn', 'ARC-RCM', 'GP Consult')
ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;

-- Site locations from personnel data
INSERT INTO locations (name, type) VALUES ('Eskom - Matimba', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Kathu', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('KwaZulu Natal', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('KwaZulu Natal - Hillside', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('KwaZulu Natal - Tronox', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Longmeadow H/O', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Mozambique', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Namibia', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Neopak - Rosslyn', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('PMR', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('RBMR and PMR', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Remote Centre', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Roamer', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Samancor - Doornbosch', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Samancor - ECM Tweefontein', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Samancor - MFC', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Samancor - Millcell', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Samancor - Mooinooi', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Samancor - TAS', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Samancor Tweefontein / Samancor Doornbosch', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Seriti - Khutala', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Springs', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Steelpoort', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Valterra - Mototolo', 'Site') ON CONFLICT (name) DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Valterra - Waterval', 'Site') ON CONFLICT (name) DO NOTHING;

-- ============================================
-- CUSTOMERS DATA (190 customers)
-- ============================================

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00002', 'A Siwele General Services', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', NULL, 'vat_not_registered', 'giftmsimeki3@gmail.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('1SS504', 'ABACO Offshore Limited', 'USD', 'Kuala', 'Wilayah Persekutuan Kuala Lumpur', 'Malaysia', 'L+�hne', NULL, 'Germany', NULL, 'overseas', 'gabriel.tungo@bumiarmada.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00004', 'Abengoa Solar Power South Africa (Pty) Ltd - Xina O & M Company', 'ZAR', 'Cape Town', 'Western Cape', 'South Africa', 'Cape Town', 'Western Cape', 'South Africa', '4250279033', 'vat_registered', 'jodine.waterboer@abengoa.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('2SE106', 'AECI Mining Chemicals, a division of AECI Mining Ltd', 'ZAR', 'Sasolburg', 'Free State', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4140211857', 'vat_registered', 'neels.vanvuuren@aeciworld.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('1AF201', 'African  Oxygen Limited t/a Afrox', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4120110541', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('2AI106', 'Air Liquide Large Industries (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'Belgium', '4480103177', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00008', 'Air Products South Africa (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4020120673', 'vat_registered', 'sandiso.mngadi@airproducts.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00009', 'Air Rotory Services (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4470274590', 'vat_registered', 'Retha@airrotoryservices.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00010', 'Almec Manufacturing (Pty) Ltd', 'ZAR', 'Klerksdorp', 'North West', 'South Africa', 'Uraniaville', NULL, 'South Africa', '4300112838', 'vat_registered', 'heino@almecmanufacturing.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00011', 'Ana-Digi Systems (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, 'Antwerpen', 'Belgium', '4160103661', 'vat_registered', 'hanneleze@anadigi.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00012', 'Valterra Platinum Limited - Precious Metals Refineries', 'ZAR', 'Rustenburg', 'North-West', 'South Africa', 'Rustenburg', 'North-West', 'South Africa', '4310113883', 'vat_registered', 'freddie.mocke@valterraplatinum.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00013', 'ArcelorMittal South Africa Limited LSP - Newcastle', 'ZAR', NULL, 'Lourches', 'France', NULL, NULL, 'France', '4920114990', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('2CO303', 'Ardagh Glass Packaging (Pty) Ltd -  Clayville', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'South Africa', '4890235403', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00015', 'Ardagh Glass Packaging (Pty) Ltd - Nigel', 'ZAR', NULL, 'Gauteng', 'South Africa', 'Pretoriusstad', 'Gauteng', 'Netherlands', '4890235403', 'vat_registered', 'gerrie.cloete@ardaghgroup.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00016', 'Ardagh Glass Packaging (Pty) Ltd - Olifantsfontein', 'ZAR', NULL, NULL, 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4890235403', 'vat_registered', 'Vongani.Mkhabele@ardaghgroup.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00017', 'Ardagh Glass Packaging (Pty) Ltd - Wadeville', 'ZAR', 'Germiston', 'Gauteng', 'South Africa', 'Germiston', 'Gauteng', 'South Africa', '4890235403', 'vat_registered', 'Neo.Leepile@ardaghgroup.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00018', 'Assmang Iron Ore - Khumani Mine', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Kuruman', NULL, 'South Africa', '4310113883', 'vat_registered', 'Keitumetse.Komet@assmang.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00019', 'Astec Industries South Africa (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4570189573', 'vat_registered', 'fventer@astecindustries.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00020', 'Atlantica South Africa Operations (Pty) Ltd', 'ZAR', 'Upington', 'Northern Cape', 'South Africa', 'Upington', 'Northern Cape', NULL, '4470302003', 'vat_registered', 'gillnorishia.lategaan@abengoa.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00021', 'Blendcor (Pty) Ltd', 'ZAR', 'Bluff', 'Kwazulu-Natal', 'South Africa', 'Bluff', 'Kwazulu-Natal', 'South Africa', '4730133743', 'vat_registered', 'Bobby.Pillay@blendcor.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00022', 'Blue Mining Services (Pty) Ltd', 'ZAR', 'Middelburg', 'Mpumalanga', 'South Africa', 'Middelburg', 'Mpumalanga', 'South Africa', NULL, 'vat_not_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00023', 'Candex South Africa (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4870231125', 'vat_registered', 'palesa.mothale@alstomgroup.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00024', 'CBI Electric African Cables (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Vereeniging', NULL, 'South Africa', '4750215859', 'vat_registered', 'enock.ngubane@cbi-electric.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00025', 'City of Cape Town', 'ZAR', 'Bellville', 'Western Cape', 'South Africa', NULL, NULL, NULL, '4500193497', 'vat_registered', 'Siyabonga.Manyamalala@capetown.gov.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00026', 'Clover SA (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4960141853', 'vat_registered', 'wesley.botes@clover.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00027', 'CNNC R+�ssing Uranium', 'NAD', 'Arandis', 'Windhoek', 'Namibia', NULL, 'Arandis', 'Namibia', NULL, 'vat_not_registered', 'Kenneth.Strauss@Rossing.com.na')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00028', 'Cofco International Standerton Oil Mills (Pty) Ltd', 'ZAR', 'Standerton', 'Mpumalanga', 'South Africa', 'Standerton', NULL, 'South Africa', '4780262830', 'vat_registered', 'BasilHolloway@cofcointernational.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00029', 'Columbus Stainless (Pty) Ltd', 'ZAR', 'Middelburg', 'Mpumalanga', 'South Africa', 'Middelburg', 'Mpumalanga', 'South Africa', '4640196368', 'vat_registered', 'wilson.robin@columbus.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00030', 'Concor Construction (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'South Africa', '4310110764', 'vat_registered', 'dave.timm@concor.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00032', 'Corruseal Corrugated - Gauteng', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4130107297', 'vat_registered', 'thembi@corruseal.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00033', 'D & S Crane & Plant Hire cc', 'ZAR', 'Richards Bay', 'Kwazulu-Natal', 'South Africa', NULL, NULL, 'Netherlands', NULL, 'vat_not_registered', 'admin@dands.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00034', 'David Brown Santasalo SA (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Lockwood', NULL, 'United Kingdom', NULL, 'vat_not_registered', 'Thato.Diale@dbsantasalo.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00035', 'De Aar Solar Power (RF) (Pty) Ltd', 'ZAR', 'Claremont', 'Western Cape', 'South Africa', 'De Aar', NULL, 'South Africa', '4920261817', 'vat_registered', 'sulana.dejager@globeleq.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00036', 'De Beers Marine Namibia (Pty) Ltd', 'ZAR', 'Windhoek', 'Khomas Region', 'Namibia', 'Dr. Frans Indongo Street', NULL, 'Namibia', '4520131816', 'vat_registered', 'Jaco.vanHeerden@debmarine.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00037', 'Diesel Innovations (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4330198146', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00038', 'Drivetek Engineeing (Pty) Ltd', 'ZAR', 'Westmead', 'Kwazulu-Natal', 'South Africa', 'Westmead', 'Kwazulu-Natal', NULL, '4470284540', 'vat_registered', 'kevinw@technidrives.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00039', 'DRS Innovative Mining Solutions', 'USD', 'Lubumbashi', 'Katanga', 'Democratic Republic of Congo', 'M++hlgasse 18-20', NULL, 'Germany', NULL, 'overseas', 'Marat.Tulegenov@ergafrica.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00040', 'D++rr Africa (Pty) Ltd - Balancing & Assembly Products', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', NULL, 'vat_not_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00041', 'Dwarsrivier Chrome mine (Pty) Ltd', 'ZAR', 'Lydenburg', 'Limpopo', 'South Africa', 'Steelpoort', 'Limpopo', 'South Africa', '4210272078', 'vat_registered', 'jacoh@dwarsrivier.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00042', 'Dynatec - Madagascar SA', 'USD', NULL, 'Toamasina', 'Madagascar', NULL, 'Toamasina', 'Madagascar', NULL, 'overseas', 'Manitra.Razafindraibe@ambatovy.mg')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00043', 'Elite Truck Hire', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4130141197', 'vat_registered', 'lesleyp@elitetruck.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00044', 'Engie - Peakers Operations (Pty) Ltd', 'ZAR', 'Durban', 'Kwazulu-Natal', 'South Africa', 'uMhlanga', 'Umhlanga Ridge', 'South Africa', '4580269977', 'vat_registered', 'natasha.james@engie.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00045', 'Engie - Kathu Operations (Pty) Ltd', 'ZAR', 'Kathu', 'Northern Cape', 'South Africa', 'Kathu', 'Northern Cape', 'South Africa', '4420278790', 'vat_registered', 'nomathamsanqa.mdlela@engie.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00046', 'Everest Equipment And Control cc', 'ZAR', 'Durban', 'Kwazulu-Natal', 'South Africa', NULL, NULL, NULL, NULL, 'vat_not_registered', 'ran@everestsa.net')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00047', 'F Momberg BK t/a CMS Condition Monitoring Services', 'ZAR', 'Nelspruit (Mbombela)', 'Mpumalanga', 'South Africa', NULL, NULL, NULL, '4490194711', 'vat_registered', 'accounts@comoserv.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00048', 'Firmenich (Pty) Ltd - Firsouth', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Hounslow', NULL, 'United Kingdom', '4760105330', 'vat_registered', 'morongoa.maponya@dsm-firmenich.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00049', 'Firmenich (Pty) Ltd - Firzar', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Hounslow', NULL, 'United Kingdom', '4760105330', 'vat_registered', 'Sibongile.Maluleka@firmenich.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00050', 'Fixturlaser South Africa (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4320268784', 'vat_registered', 'gerrit@fixturlaser.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00051', 'FLSmidth SA - Saldanha', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, 'Madrid', 'Spain', '4620206328', 'vat_registered', 'lincoln.frank@flsmidth.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00052', 'Fraser Alexander (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4860224031', 'vat_registered', 'KhumbulaniS@fraseralexander.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00053', 'Frys Metals a division of LeadX (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4820314369', 'vat_registered', 'NkosinathiG@Frys.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00054', 'GEA Africa (Pty) Ltd - Heating & Refrigeration Solutions Service', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', NULL, 'vat_not_registered', 'Langelihle.Mlovu@gea.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00055', 'GEA Africa (Pty) Ltd - Sparta, Welkom', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', NULL, 'vat_not_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00056', 'Givaudan South Africa (Pty) Ltd', 'ZAR', 'Johannesburg', 'Tulisa Park', 'South Africa', 'Johannesburg South', 'Gauteng', 'South Africa', '4890107479', 'vat_registered', 'Nicole.davis@givaudan.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00057', 'Glencore Marafe Venture - PSV Magareng Mine', 'ZAR', 'Rustenburg', 'North-West', 'South Africa', 'Rustenburg', 'North-West', 'South Africa', '4010216903', 'vat_registered', 'reinett.mohlala@glencore.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00058', 'Glencore Merafe Join Venture - PSV Helena', 'ZAR', 'Steelpoort', 'Limpopo', 'South Africa', 'Steelpoort', 'Limpopo', 'South Africa', '4010216903', 'vat_registered', 'Cheryl-Ann.Bezuidenhout@glencore.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00059', 'Glencore - PSV Lonmin EPL (UG2)', 'ZAR', 'Marikana', 'North West', 'South Africa', 'Marikana', 'North West', 'South Africa', NULL, 'vat_not_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00060', 'GRN Constructions Ltd', 'ZAR', 'Eggleston', 'Cobwebs', 'United Kingdom', 'Eggleston', 'Cobwebs', 'United Kingdom', NULL, 'overseas', 'purchase01@grnc21.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00061', 'GZ Industries South Africa (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4760282196', 'vat_registered', 'Katlego.Moloko@gzican.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00062', 'Harmony Moab Khotsong Operations (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'South Africa', '4250280130', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00063', 'Heineken Beverages - Springs', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, 'Amsterdam', 'Netherlands', '4180211080', 'vat_registered', 'cherese.bosch@heineken.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00064', 'Heineken Beverages - Wadeville', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Burgemeester Smeetsweg 1', NULL, 'Netherlands', '4180211080', 'vat_registered', 'Kabelo.bokgwathile@heineken.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00065', 'Howden Africa Compressor and Turbines (HACT)', 'ZAR', 'Stikland', 'Western Cape', 'South Africa', 'Havelandseweg 8A', 'Industrieterrein Haveland', 'Netherlands', '4610118533', 'vat_registered', 'Caroline.Booysen@howden.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00066', 'Hytec South Africa (RF) (Pty) Ltd - Richards Bay', 'ZAR', 'Richards Bay', 'KwaZulu-Natal', 'South Africa', 'Richards Bay', 'KwaZulu-Natal', 'South Africa', '4340213919', 'vat_registered', 'marius.froneman@boschrexroth.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00067', 'Idwala Industrial Holdings (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4280211352', 'vat_registered', 'asp@idwala.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00068', 'Illovo Sugar SA (Pty) Ltd - Eston', 'ZAR', NULL, 'Kwazulu-Natal', 'South Africa', 'Eston', NULL, 'South Africa', '4790254926', 'vat_registered', 'SibMkhwanazi@illovo.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00069', 'Illovo Sugar SA (Pty) Ltd - Sezela', 'ZAR', 'Durban', 'Kwazulu-Natal', 'South Africa', NULL, NULL, 'South Africa', '4790254926', 'vat_registered', 'MaGovender@ILLOVO.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00070', 'Impala Platinum Refineries Limited', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Springs', 'Geduld Proprietary Mines', 'South Africa', '4680121797', 'vat_registered', 'Brand.venter@implats.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00071', 'Industrial Water Cooling (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4210112092', 'vat_registered', 'edwin@iwc.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00072', 'Ingrain SA (Pty) Ltd - Bellville Mill', 'ZAR', 'Cape Town', 'Western Cape', 'South Africa', 'Cape Town', 'Western Cape', 'South Africa', '4670292392', 'vat_registered', 'Cheryl.Pearce@ingrainsa.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00073', 'Ingrain SA (Pty) Ltd - Germiston Mill', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4670292392', 'vat_registered', 'Thembekile.Salman@ingrainsa.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00074', 'Ingrain SA (Pty) Ltd - Kliprivier Mill', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Witkopdorp (Daleside', 'Daleside', 'South Africa', '4670292392', 'vat_registered', 'Tubi.Mokotong@ingrainsa.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00075', 'Kalagadi Manganese (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4230235865', 'vat_registered', 'tebogo.maroeshe@kalagadi.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00076', 'Karan Beef (Pty) Ltd - Balfour', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Balfour', NULL, 'South Africa', '4100174228', 'vat_registered', 'benniek@karanbeef.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00077', 'Karan Beef (Pty) Ltd - City Deep', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg South', 'Gauteng', 'South Africa', '4100174228', 'vat_registered', 'Bhernard.Montgomery@karanbeef.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00078', 'Kelvin Powerstation (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'United Kingdom', '4220193553', 'vat_registered', 'tenders@kelvinpower.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00079', 'Kibali Gold Mine', 'USD', 'Kinshasa', 'Kinshasa', 'Democratic Republic of Congo', NULL, NULL, NULL, NULL, 'overseas', 'renet@wearcheck.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00080', 'Kimberly Clark (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Copernicuslaan 35', NULL, 'Netherlands', '4220105342', 'vat_registered', 'abrahamchristoffelbraam.radley@kcc.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00081', 'Knorr Bremse', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Rendementsweg 4N', NULL, 'Netherlands', '4430101404', 'vat_registered', 'rudi.durandt@knorr-bremse.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00082', 'Kwena Mining Projects (Pty) Ltd', 'ZAR', 'Witbank', 'Mpumalanga', 'South Africa', 'Emalahleni', 'Mpumalanga', 'South Africa', '4260238870', 'vat_registered', 'chrisoost@kwenamining.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00083', 'Lactalis South Africa (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4460149752', 'vat_registered', 'Jabulani-Christ.Memela@za.lactalis.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00084', 'Marketech Consulting Engineers (Pty) Ltd', 'ZAR', 'Ashton-on-Ribble', 'Navigation Way', 'United Kingdom', 'Ashton-on-Ribble', 'Navigation Way', 'United Kingdom', '4130281724', 'vat_registered', 'jp@marketech.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00085', 'Martin and Robson South Africa', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4610295372', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00086', 'Eskom - Matimba Powerstation', 'ZAR', 'Lephalale', 'Limpopo', 'South Africa', 'Lephalale', 'Limpopo', 'South Africa', '4740101508', 'vat_registered', 'molaudr@eskom.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00087', 'McCain Foods South Africa (Pty) Ltd - Delmas', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'South Africa', '4420188494', 'vat_registered', 'sabelo.mehlomakhulu@mccain.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00088', 'McCain Foods South Africa (Pty) Ltd - Springs', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4420188494', 'vat_registered', 'carl.nel@mccain.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00089', 'Mediclinic (Pty) Ltd - Stellenbosch', 'ZAR', 'Stellenbosch', 'Western Cape', 'South Africa', 'Stellenbosch', 'Western Cape', 'South Africa', '4760118184', 'vat_registered', 'audrey.govindasamy@mediclinic.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00090', 'MediClinic(Pty) Ltd - Kloof', 'ZAR', 'Pretoria', 'Gauteng', 'South Africa', NULL, NULL, 'Belgium', '4190170326', 'vat_registered', 'Fhatuwani.Nemudivhiso@Mediclinic.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00091', 'Middelburg Mine Services - Seriti Power (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Middelburg', 'R575', 'South Africa', '4850204555', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00092', 'Modikwa Platinum Mine', 'ZAR', 'Driekop', 'Limpopo', 'South Africa', 'Burgersfort', 'Limpopo', 'South Africa', '4310113883', 'vat_registered', 'moses.mathopo@angloamerican.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00093', 'Mondi South Africa (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4330102007', 'vat_registered', 'pieter.bekker@mondigroup.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00094', 'Mpact Operations (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'United Kingdom', '4590176527', 'vat_registered', 'KAmiappen@Mpact.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00095', 'MpowerU Africa (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4920273176', 'vat_registered', 'charnel@mpoweru.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00096', 'Msobo Coal (Pty) Ltd', 'ZAR', 'Breyten', 'Mpumalanga', 'South Africa', NULL, NULL, 'South Africa', '4030216297', 'vat_registered', 'rodney.white@northerncoal.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00097', 'Nampak Products Ltd T/A Bevcan', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Oldends Lane', 'Severnside', 'United Kingdom', '4230113039', 'vat_registered', 'neels.vanderwesthuizen@nampak.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00098', 'Nasonti Technical Services (Pty) Ltd - Goedehoop Colliery', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, NULL, '4450280922', 'vat_registered', 'Wesleyb@nasonti.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00099', 'NDTS - Non Destructive Testing Services', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Van Slingelandtlaan 39', NULL, 'Netherlands', '4150150373', 'vat_registered', 'jeanpierrep@ndts.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00100', 'Nedbank Limited - Bloemfontein', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Bloemfontein', 'Free State', 'South Africa', '4320116074', 'vat_registered', 'TebohoMa@nedbank.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00101', 'Nedbank Limited - Kingsmead', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'Jersey', '4320116074', 'vat_registered', 'SeshneeG@Nedbank.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00102', 'Nedbank Limited - Meadowdale', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4320116074', 'vat_registered', 'UrsulaC@nedbank.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00103', 'Nedbank Limited - Menlyn Maine Campus', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Pretoria', 'Gauteng', 'South Africa', '4320116074', 'vat_registered', 'Sipho.Mthethwa@bidvestfm.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00104', 'Nedbank Limited - Park Square Uhmlanga Rock', 'ZAR', 'Umhalanga Rocks', 'Kwazulu-Natal', 'South Africa', 'uMhlanga', 'KwaZulu-Natal', 'South Africa', '4320116074', 'vat_registered', 'StrinivassanC@Nedbank.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00105', 'Nedbank Limited - Pietermaritzburg', 'ZAR', 'Pietermaritzburg', 'KwaZulu-Natal', 'South Africa', 'Pietermaritzburg', 'KwaZulu-Natal', 'South Africa', '4320116074', 'vat_registered', 'LindiweMahla@Nedbank.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00106', 'Nedbank Limited - Polokwane', 'ZAR', 'Polokwane', 'Limpopo', 'South Africa', 'Polokwane', 'Limpopo', 'South Africa', '4320116074', 'vat_registered', 'MorwediP@Nedbank.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00107', 'Nedbank Limited - Rivonia', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4320116074', 'vat_registered', 'MphoMolo@nedbank.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00108', 'Nedbank Limited - Stoneridge', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4320116074', 'vat_registered', 'UrsulaC@nedbank.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00109', 'Nedbank Limited - Witfontein', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'South Africa', '4320116074', 'vat_registered', 'UrsulaC@nedbank.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00110', 'Neopak (Pty) Ltd - Rosslyn', 'ZAR', 'Pretoria', 'Gauteng', 'South Africa', 'Pretoria', 'Gauteng', 'South Africa', '4290268541', 'vat_registered', 'Nthabiseng.Nkhumise@neopak.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00111', 'Northam Booysendal - Lydenburg', 'ZAR', 'Lydenburg', 'Mpumalanga', 'South Africa', NULL, NULL, 'South Africa', '4070202751', 'vat_registered', 'Kgalemo.Lentswe@norplats.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00112', 'Northam Platinum Limited', 'ZAR', 'Brits', 'North West', 'South Africa', 'Brits', 'R566', 'South Africa', '4530124520', 'vat_registered', 'Advice.Letshela@norplats.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00113', 'OPmobility (Pty) Ltd', 'ZAR', 'Brits', 'North-West', 'South Africa', NULL, NULL, NULL, '4310177854', 'vat_registered', 'Willie.kotze@plasticomnium.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00114', 'Peermont Global- Umfolozi Hotel, Casino, and Convention Resort', 'ZAR', 'Empangeni', 'Kwazulu-Natal', 'South Africa', 'Empangeni', 'KwaZulu-Natal', 'South Africa', NULL, 'vat_not_registered', 'pmaharaj@umfolozicasino.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00115', 'Pentalin Processing (Pty) Ltd - Kleinfontein Colliery', 'ZAR', 'Emalahleni', 'Mpumalanga', 'South Africa', 'Emalahleni', 'KwaZulu-Natal', 'South Africa', '4530277385', 'vat_registered', 'schalk@pentalin.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00116', 'Pentalin Processing  (Pty) Ltd - Mgayo', 'ZAR', 'Emalahleni', 'Mpumalanga', 'South Africa', 'Emalahleni', 'KwaZulu-Natal', 'South Africa', '4530277385', 'vat_registered', 'sam@pentalin.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00117', 'Pentalin Processing (Pty) Ltd - Mzimkhulu Colliery', 'ZAR', 'Emalahleni', 'Mpumalanga', 'South Africa', 'Emalahleni', 'KwaZulu-Natal', 'South Africa', '4530277385', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00118', 'Pentalin Processing (Pty) Ltd - Rietvlei', 'ZAR', 'Emalahleni', 'Mpumalanga', 'South Africa', 'Emalahleni', 'KwaZulu-Natal', 'South Africa', '4530277385', 'vat_registered', 'janhendrik@pentalin.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00119', 'PFG Building Glass (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4550138848', 'vat_registered', 'ygovender@pg.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00120', 'PMC Palabora Mining Company', 'ZAR', 'Phalaborwa', 'Limpopo', 'South Africa', 'Phalaborwa', 'Limpopo', 'South Africa', NULL, 'vat_not_registered', 'Ezrom.Khosa@palabora.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00121', 'Proxa Water SA (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'Belgium', '4200264523', 'vat_registered', 'JWiese@proxawater.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00122', 'Puregas (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4340227109', 'vat_registered', 'muzi@puregas.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00123', 'QIT Minerals - Madagascar', 'USD', 'Fort Dauphin', 'Antananarivo', 'Madagascar', 'Fort Dauphin', 'Antananarivo', 'Madagascar', NULL, 'overseas', 'Amelia.Louw@riotinto.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00124', 'Rand Plastics', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'Netherlands', '4020116010', 'vat_registered', 'buyer1@randplastics.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00125', 'Rheinmetall Denel Munition (RF) (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4020247856', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00126', 'RPM Amandelbult Limited', 'ZAR', 'Amandelbult', 'Limpopo', 'South Africa', 'Amandelbult', 'Limpopo', 'South Africa', '4310113883', 'vat_registered', 'dries.lusse@angloamerican.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00127', 'RPM Amandelbult Limited - Locomotive', 'ZAR', 'Chromite', 'Limpopo', 'South Africa', NULL, NULL, NULL, '4310113883', 'vat_registered', 'Dries.Lusse@angloamerican.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00128', 'Valterra Platinum Limited - Mortimer Smelter', 'ZAR', 'Rustenburg', 'North-West', 'South Africa', 'Rustenburg', 'North-West', 'South Africa', '4310113883', 'vat_registered', 'karabo.sathekge@valterraplatinum.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00129', 'Valterra Platinum Limited - Converter Plant (VCP)', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4310113883', 'vat_registered', 'edwin.moabi@angloamerican.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00130', 'Valterra Platinum Limited - Base Metals Refinery', 'ZAR', 'Rustenburg', 'North-West', 'South Africa', 'Rustenburg', 'North-West', 'South Africa', '4310113883', 'vat_registered', 'beulise.vermaak@valterraplatinum.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00131', 'Valterra Platinum Limited - Mototolo Complex - Borwa', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Burgersfort', 'Limpopo', 'South Africa', '4310113883', 'vat_registered', 'Mzwakhe.Mbatha@valterraplatinum.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00132', 'Valterra Platinum Limited - Mototolo Complex - Lebowa', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4520131816', 'vat_registered', 'Mzwakhe.Mbatha@valterraplatinum.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00133', 'Valterra Platinum Limited - Polokwane Smelter', 'ZAR', 'Polokwane', 'Limpopo', 'South Africa', NULL, NULL, NULL, '4310113883', 'vat_registered', 'eulanda.sibande@angloamerican.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00134', 'Rustenburg Platinum Mines Limited - Mototolo Concentrator', 'ZAR', 'Lydenburg', 'Mpumalanga', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4310113883', 'vat_registered', 'Phumlani.Hlomuka@angloamerican.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00135', 'Valterra Platinum Limited - Waterval Smelters', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Rustenburg', 'North West', 'South Africa', '4310113883', 'vat_registered', 'amo.mosito@valterraplatinum.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00136', 'Ruzanche Solutions (Pty) Ltd', 'ZAR', NULL, NULL, 'South Africa', NULL, NULL, NULL, NULL, 'vat_not_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00137', 'SA Metal Group (Pty) Ltd', 'ZAR', 'Cape Town', 'Western Cape', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4190108110', 'vat_registered', 'robert.young@sametal.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00138', 'Sabot SA (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4730228774', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00139', 'Saint Gobain Construction Products SA (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'Netherlands', '4430103087', 'vat_registered', 'Kenneth.netshitholwe@saint-gobain.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00140', 'Saint Gobain Construction Products SA (Pty) Ltd - Isover', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'Netherlands', '4430103087', 'vat_registered', 'Kylan.Pillay@saint-gobain.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00143', 'Sappi Southern Africa Ltd - Ngodwana Mill', 'ZAR', 'Mbombela', 'Mpumalanga', 'South Africa', 'Mbombela', 'Mpumalanga', 'South Africa', '4750105456', 'vat_registered', 'Hubert.DuPreez@sappi.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00144', 'Haggie Wire and Strand (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Germiston', 'Gauteng', 'South Africa', '4120313434', 'vat_registered', 'pscholtz@haggie.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00145', 'Sequence Logistics (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4800220065', 'vat_registered', 'Robyn.Harris@selog.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00146', 'Seriti Power (Pty) Ltd - Khutala Colliery', 'ZAR', 'Ogies', 'Mpumalanga', 'South Africa', 'Ogies', 'R555', 'South Africa', '4850204555', 'vat_registered', 'santosh.ca.kumar@seritiza.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00147', 'Seriti ZA - Kriel Colliery', 'ZAR', 'Ga-nala', 'Kriel Rd Kriel Colliery', 'South Africa', 'Ga-nala', 'Kriel Rd Kriel Colliery', 'South Africa', '4420277487', 'vat_registered', 'pretty.buthelezi@seritiza.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00148', 'Service First Cape (Pty) Ltd', 'ZAR', 'Cape Town', 'Western Cape', 'South Africa', 'Cape Town', 'Western Cape', 'South Africa', '4430209892', 'vat_registered', 'natheer@sfirst.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00149', 'SEW Eurodrive (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Component 125 - 127', NULL, 'Netherlands', NULL, 'vat_not_registered', 'epretorius@sew.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00150', 'Sibanye Stillwater (Pty) Ltd - Eastern Platinum - Saffy Shaft', 'ZAR', NULL, NULL, 'South Africa', NULL, NULL, 'South Africa', NULL, 'vat_not_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00151', 'Sibanye Rustenburg Platinum Mines (Pty) Ltd', 'ZAR', 'Kroondal', NULL, 'South Africa', NULL, 'Kroondal', 'South Africa', '4490221779', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00152', 'South African Sugar Association', 'ZAR', 'Durban North', 'Kwazulu-Natal', 'South Africa', 'Mount Edgecombe', 'Blackburn Estate', 'South Africa', '4410108247', 'vat_registered', 'Sindi.Gumede@sasa.org.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('1AL024', 'South32 - Hillside Aluminium (Pty) Ltd', 'ZAR', 'Richards Bay', 'Kwazulu-Natal', 'South Africa', 'Richards Bay', 'Kwazulu-Natal', 'South Africa', '4460199757', 'vat_registered', 'johan.j.oberholzer@south32.net')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00154', 'Specialised Air-conditioning Solutions (Pty) Ltd', 'ZAR', 'Durban North', 'Kwazulu-Natal', 'South Africa', 'Durban', 'KwaZulu-Natal', 'South Africa', NULL, 'vat_not_registered', 'dylan@sasaircon.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00155', 'Steinmuller Africa (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'South Africa', '4550116778', 'vat_registered', 'jean-pierre.van.niewenhuizen@bilfinger.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00156', 'Swartland Insulation (Pty) Ltd', 'ZAR', 'Cape Town', 'Western Cape', 'South Africa', 'Johannesburg', 'Gauteng', NULL, '4060288067', 'vat_registered', 'pdmaintenannce@Swartland.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00157', 'Swartland Investments (Pty) Ltd', 'ZAR', 'Atlantis', 'Western Cape', 'South Africa', 'Moorreesburg', NULL, 'South Africa', '4280268402', 'vat_registered', 'pdmaintenance@Swartland.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00158', 'Table Mountain Cableway (Pty) Ltd', 'ZAR', 'Cape Town', 'Western Cape', 'South Africa', 'Cape Town', 'Western Cape', 'South Africa', '4140101058', 'vat_registered', 'emile@tablemountain.net')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00159', 'Teralco Logistics', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', NULL, 'vat_not_registered', 'werner.bossert@teralco.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00160', 'Thaba Moshate Hotel, Casino and Convention Resort', 'ZAR', 'Burgersfort', 'Limpopo', 'South Africa', 'Burgersfort', NULL, 'South Africa', NULL, 'vat_not_registered', 'MMugagadeli@thabamoshate.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00161', 'Thaga Engineering (Pty) Ltd', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', 'Centurion', 'Gauteng', 'South Africa', '4220271193', 'vat_registered', 'nare@thagaengineering.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00162', 'Tharisa Minerals - Genesis', 'ZAR', 'Rustenburg', 'North-West', 'South Africa', 'Rustenburg', 'North-West', 'South Africa', '4860238387', 'vat_registered', 'dsithole@tharisa.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00163', 'Tharisa Minerals - Voyager', 'ZAR', 'Rustenburg', 'North-West', 'South Africa', 'Rustenburg', 'North-West', 'South Africa', '4860238387', 'vat_registered', 'ptshabalala@tharisa.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00164', 'Tharisa Minerals - Vulcan Plant', 'ZAR', 'Rustenburg', 'North-West', 'South Africa', 'Rustenburg', 'North-West', 'South Africa', '4860238387', 'vat_registered', 'TMaruma@tharisa.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00165', 'The South African Breweries', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'Netherlands', '4160180495', 'vat_registered', 'Gonasagren.Chetty@za.ab-inbev.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00166', 'Thungela Operations (Pty) Ltd', 'ZAR', 'Klipfontein', 'Western Cape', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4710102072', 'vat_registered', 'ipretorius@proxawater.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00167', 'Thungela Operations (Pty) Ltd - Isibonelo Colliery', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'South Africa', '4710102072', 'vat_registered', 'thulani.mdhlalose@thungela.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00168', 'Tongaat Hulett Limited t/a Tongaat Hulett Sugar', 'ZAR', 'Durban', 'Kwazulu-Natal', 'South Africa', NULL, NULL, NULL, '4570102634', 'vat_registered', 'Trevor.Naidoo@tongaat.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00169', 'Tronox KZN Sands (Pty) Ltd', 'ZAR', 'Empangeni', 'Kwazulu-Natal', 'South Africa', 'Empangeni', 'KwaZulu-Natal', 'South Africa', '4500118130', 'vat_registered', 'nicole.seumangal@tronox.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00170', 'THM - Twickenham Platinum mine - Hackney Shaft', 'ZAR', 'Driekop', 'Limpopo', 'South Africa', NULL, NULL, NULL, '4310113883', 'vat_registered', 'leonard.mafahla@angloamerican.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00171', 'TWK Agri (Pty) Ltd - Richards Bay Woodchip Mill', 'ZAR', 'Richards Bay', 'Kwazulu-Natal', 'South Africa', 'Richards Bay', 'KwaZulu-Natal', 'South Africa', NULL, 'vat_not_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00172', 'Two Rivers Platinum (Pty) Ltd', 'ZAR', 'Lydenburg', 'Mpumalanga', 'South Africa', 'Burgersfort', NULL, 'South Africa', '4180194443', 'vat_registered', 'elize.bobraine@trp.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00173', 'Vector Logistics - Belville South, Cape Town', 'ZAR', 'Cape Town', 'Western Cape', 'South Africa', 'Cape Town', 'Western Cape', 'South Africa', '4380198566', 'vat_registered', 'DuaneF@vectorlog.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00174', 'Vector Logistics - Linbro Park', 'ZAR', 'Durban', 'Kwazulu-Natal', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', '4380198566', 'vat_registered', 'stanleym2@vectorlog.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00175', 'Vector Logistics - Nelspruit', 'ZAR', 'Nelspruit', 'Free State', 'South Africa', 'D++rrenh++belstrasse 6', NULL, 'Switzerland', '4380198566', 'vat_registered', 'WilliamM2@vectorlog.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00176', 'Vector Logistics - Polokwane', 'ZAR', 'Durban', 'Kwazulu-Natal', 'South Africa', 'Polokwane', 'Limpopo', 'South Africa', '4380198566', 'vat_registered', 'DavidL@vectorlog.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00178', 'Vector Logistics - Thekwini Hub', 'ZAR', 'Johannesburg', 'Kwazulu-Natal', 'South Africa', 'Durban', 'KwaZulu-Natal', 'South Africa', '4380198566', 'vat_registered', 'DavidL@vectorlog.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00179', 'Veolia Water Solutions & Technologies SA', 'ZAR', 'Johannesburg', 'Gauteng', 'South Africa', NULL, NULL, 'Netherlands', '4650105341', 'vat_registered', 'siva.chetty@veolia.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00180', 'WearCheck - Mozambique', 'ZAR', NULL, 'Harare', 'Zimbabwe', NULL, 'Harare', 'Zimbabwe', NULL, 'overseas', 'Riaandp@wearcheckRS.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00181', 'WearCheck - Namibia', 'ZAR', NULL, NULL, 'Namibia', NULL, NULL, NULL, NULL, 'overseas', 'gerritf@wearcheck.co.na')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00182', 'WestonaWestonaria Borwa Mega Project (Pty) Ltd', 'ZAR', 'Johannesburg', 'Marshalltown', 'South Africa', 'Johannesburg', 'Gauteng', 'South Africa', NULL, 'vat_not_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00183', 'Zargodox (Pty) Ltd', 'ZAR', 'Hartebeespoort', 'North West', 'South Africa', NULL, NULL, NULL, '4400253979', 'vat_registered', 'louisv@hartiescableway.co.za')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00186', 'LH Marthinusem', 'ZAR', NULL, NULL, NULL, NULL, NULL, NULL, '4160247682', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00189', 'Omnia Fertilizer, a Division of Omnia Group (Pty) Ltd', 'ZAR', NULL, NULL, NULL, NULL, NULL, NULL, '4680233469', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00190', 'Anglo American Sishen Kumba Iron Ore', 'ZAR', 'Kathu', 'Northern Cape', 'South Africa', 'Kathu', 'Northern Cape', 'South Africa', NULL, 'vat_not_registered', 'amogelang.gaosekwe@angloamerican.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00192', 'Samancor - Dikwena Chrome Smelting (DCR)', 'ZAR', 'Brits', 'North-West', 'South Africa', 'Brits', 'North-West', 'South Africa', '4040285837', 'vat_registered', NULL)
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00193', 'Samancor - Eastern Chrome Mines Doornbosch (DRB)', 'ZAR', 'Steelpoort', 'Limpopo', 'South Africa', NULL, NULL, NULL, '4680101393', 'vat_registered', 'Lebo.Mosito@SamancorCr.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00194', 'Samancor - Eastern Chrome Mines Tweefontein (TFN)', 'ZAR', 'Steelpoort', 'Limpopo', 'South Africa', 'Steelpoort', 'Limpopo', 'South Africa', '4680101393', 'vat_registered', 'Lebo.Mosito@SamancorCr.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00195', 'Samancor - Ferrometals (FMT)', 'ZAR', 'Emalahleni (Witbank)', 'Mpumalanga', 'South Africa', 'Emalahleni (Witbank)', 'Mpumalanga', 'South Africa', '4680101393', 'vat_registered', 'frikkie.conradie@samancorcr.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00196', 'Samancor - Middelburg Ferrochrome (MFC)', 'ZAR', 'Middelburg', 'Mpumalanga', 'South Africa', 'Middelburg', 'Mpumalanga', 'South Africa', '4680101393', 'vat_registered', 'sibusiso.hlakanyana@samancorcr.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00197', 'Samancor - TC Smelter (TCS)', 'ZAR', 'Mooinooi', 'North-West', 'South Africa', 'Mooinooi', 'North-West', 'South Africa', '4350272946', 'vat_registered', 'david@wearcheckrs.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00198', 'Samancor - Tubatse Alloy (TAS)', 'ZAR', 'Steelpoort', 'Limpopo', 'South Africa', 'Ga Maroga', 'Limpopo', 'South Africa', '4380272940', 'vat_registered', 'shepherd.jambaya@samancorcr.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00199', 'Samancor - Tubatse Ferrochrome (TFC)', 'ZAR', 'Steelpoort', 'Limpopo', 'South Africa', 'Steelpoort', NULL, 'South Africa', '4630235275', 'vat_registered', 'paul.tsheole@samancorcr.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)
VALUES ('CUS-00200', 'Samancor - Western Chrome Mines (WCM)', 'ZAR', 'Mooinooi', 'North-West', 'South Africa', 'Mooinooi', 'North-West', 'South Africa', '4680101393', 'vat_registered', 'klaas.matsepane@samancorcr.com')
ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;

-- ============================================
-- EQUIPMENT & CALIBRATION DATA (66 items)
-- ============================================

-- Insert equipment and calibration records using category lookups
DO $$
DECLARE
    v_category_id INTEGER;
    v_subcategory_id INTEGER;
    v_equipment_db_id INTEGER;
BEGIN

    -- Fixturlaser R2 (03362)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-03362', 'Fixturlaser R2', 'Fixturlaser South Africa (Pty) Ltd', '03362', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '03362', '2025-05-05', '2027-05-01', '03362-20250506-43457', 'Valid', 'Fixturlaser South Africa (Pty) Ltd', NULL);

    -- Acoem S7 (41718)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-41718', 'Acoem S7', 'Acoem', '41718', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '41718', '2025-03-10', '2026-03-10', '41718-20250310', 'Valid', 'Acoem', NULL);

    -- Fixturlaser M3 (85889)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-85889', 'Fixturlaser M3', 'Fixturlaser South Africa (Pty) Ltd', '85889', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '85889', '2025-05-05', '2027-05-01', '85889-20250505-43457', 'Valid', 'Fixturlaser South Africa (Pty) Ltd', NULL);

    -- Fixturlaser S3 (95889)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-95889', 'Fixturlaser S3', 'Fixturlaser South Africa (Pty) Ltd', '95889', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '95889', '2025-05-05', '2027-05-01', '95889-20250505-43457', 'Valid', 'Fixturlaser South Africa (Pty) Ltd', NULL);

    -- Flir E40 (49002016)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Camera' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-49002016', 'Flir E40', 'Repair and Metrology Services (Pty) Ltd', '49002016', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '49002016', '2025-09-01', '2026-09-01', '135305-1', 'Valid', 'Repair and Metrology Services (Pty) Ltd', NULL);

    -- sensALIGN 7 Sensor (49004275)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-49004275', 'sensALIGN 7 Sensor', 'Hersteller', '49004275', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '49004275', '2024-12-04', '2026-12-04', '1504250247 152 04', 'Valid', 'Hersteller', NULL);

    -- sensALIGN 7 Sensor (49022264)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-49022264', 'sensALIGN 7 Sensor', 'Hersteller', '49022264', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '49022264', '2024-02-13', '2026-02-13', '49475264_ 2024_02_13', 'Due Soon', 'Hersteller', NULL);

    -- sensALIGN 7 Sensor (49110800)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-49110800', 'sensALIGN 7 Sensor', 'Hersteller', '49110800', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '49110800', '2024-02-14', '2026-02-14', '49140800 2024_02_14', 'Due Soon', 'Hersteller', NULL);

    -- Flir T640 (55905783)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Equipment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-55905783', 'Flir T640', 'Flir', '55905783', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '55905783', '2025-01-20', '2026-01-20', '132288-1', 'Expired', 'Flir', NULL);

    -- Flir T530 (79302627)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Equipment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-79302627', 'Flir T530', 'Flir', '79302627', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '79302627', '2025-10-29', '2026-10-29', '136287-1', 'Valid', 'Flir', NULL);

    -- Flir T540 (79318361)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Equipment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-79318361', 'Flir T540', 'Flir', '79318361', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '79318361', '2025-03-17', '2026-03-17', '132711-1', 'Valid', 'Flir', NULL);

    -- Flir E54 (84510173)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Equipment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-84510173', 'Flir E54', 'Flir', '84510173', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '84510173', '2025-06-19', '2026-06-19', '134294-1', 'Valid', 'Flir', NULL);

    -- All Test Pro 5 (ATSX1119)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Motor Circuit Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-ATSX1119', 'All Test Pro 5', 'All Test Pro', 'ATSX1119', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'ATSX1119', '2025-07-14', '2028-07-13', 'VC0000029', 'Valid', 'All Test Pro', NULL);

    -- ATTP MCA Tester (AT701667)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Motor Circuit Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-AT701667', 'ATTP MCA Tester', 'All Test Pro', 'AT701667', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'AT701667', '2025-02-03', '2026-02-03', 'TVC0000005', 'Due Soon', 'All Test Pro', NULL);

    -- Portable Vibration Calibrator (9110D)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-9110D', 'Portable Vibration Calibrator', 'The Modal Shop', '9110D', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '9110D', '2025-11-12', '2026-11-12', 'PRD-P297', 'Valid', 'The Modal Shop', NULL);

    -- AMS2140 Analyzer (B2140140724)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B2140140724', 'AMS2140 Analyzer', 'Emerson', 'B2140140724', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B2140140724', '2025-10-31', '2026-10-30', 'C10-202549', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B2140140833)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B2140140833', 'AMS2140 Analyzer', 'Emerson', 'B2140140833', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B2140140833', '2025-10-31', '2026-10-30', 'C10-202555', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401150773)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401150773', 'AMS2140 Analyzer', 'Emerson', 'B21401150773', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401150773', '2025-10-31', '2026-10-30', 'C10-202542', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401161342)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401161342', 'AMS2140 Analyzer', 'Emerson', 'B21401161342', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401161342', '2025-03-28', '2026-03-27', 'C03-202533', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401172280)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401172280', 'AMS2140 Analyzer', 'Emerson', 'B21401172280', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401172280', '2025-04-01', '2026-04-01', 'C04-202534', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401172281)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401172281', 'AMS2140 Analyzer', 'Emerson', 'B21401172281', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401172281', '2025-10-31', '2026-10-30', 'C10-202554', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401183989)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401183989', 'AMS2140 Analyzer', 'Emerson', 'B21401183989', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401183989', '2025-10-31', '2026-10-30', 'C10-202539', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401195137)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401195137', 'AMS2140 Analyzer', 'Emerson', 'B21401195137', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401195137', '2025-04-11', '2026-04-11', 'C04-202540', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216460)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216460', 'AMS2140 Analyzer', 'Emerson', 'B21401216460', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216460', '2025-10-31', '2026-10-30', 'C10-202544', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216461)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216461', 'AMS2140 Analyzer', 'Emerson', 'B21401216461', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216461', '2025-10-31', '2026-10-30', 'C10-202541', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216462)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216462', 'AMS2140 Analyzer', 'Emerson', 'B21401216462', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216462', '2025-10-31', '2026-10-30', 'C10-202557', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216467)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216467', 'AMS2140 Analyzer', 'Emerson', 'B21401216467', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216467', '2025-10-31', '2026-10-30', 'C10-202545', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216468)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216468', 'AMS2140 Analyzer', 'Emerson', 'B21401216468', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216468', '2025-10-31', '2026-10-30', 'C10-202560', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216469)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216469', 'AMS2140 Analyzer', 'Emerson', 'B21401216469', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216469', '2025-03-28', '2026-03-27', 'C03-202531', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216472)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216472', 'AMS2140 Analyzer', 'Emerson', 'B21401216472', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216472', '2025-10-31', '2026-10-30', 'C10-202557', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216473)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216473', 'AMS2140 Analyzer', 'Emerson', 'B21401216473', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216473', '2025-10-31', '2026-10-30', 'C10-202559', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216474)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216474', 'AMS2140 Analyzer', 'Emerson', 'B21401216474', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216474', '2025-10-31', '2026-10-30', 'C10-202547', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216475)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216475', 'AMS2140 Analyzer', 'Emerson', 'B21401216475', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216475', '2025-09-03', '2026-09-02', 'C09-202501', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216476)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216476', 'AMS2140 Analyzer', 'Emerson', 'B21401216476', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216476', '2025-10-31', '2026-10-30', 'C10-202553', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216478)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216478', 'AMS2140 Analyzer', 'Emerson', 'B21401216478', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216478', '2025-10-31', '2026-10-30', 'C10-202556', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216479)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216479', 'AMS2140 Analyzer', 'Emerson', 'B21401216479', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216479', '2025-10-31', '2026-10-30', 'C10-202543', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216480)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216480', 'AMS2140 Analyzer', 'Emerson', 'B21401216480', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216480', '2025-10-31', '2026-10-30', 'C10-202551', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401216481)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401216481', 'AMS2140 Analyzer', 'Emerson', 'B21401216481', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401216481', '2025-10-31', '2026-10-30', 'C10-202552', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401237748)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401237748', 'AMS2140 Analyzer', 'Emerson', 'B21401237748', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401237748', '2025-10-31', '2026-10-30', 'C10-202546', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401237749)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401237749', 'AMS2140 Analyzer', 'Emerson', 'B21401237749', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401237749', '2025-03-28', '2026-03-27', 'C03-202530', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401237750)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401237750', 'AMS2140 Analyzer', 'Emerson', 'B21401237750', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401237750', '2025-08-25', '2026-11-24', 'CP0051', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401238055)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401238055', 'AMS2140 Analyzer', 'Emerson', 'B21401238055', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401238055', '2025-03-29', '2026-03-28', 'C10-202548', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401238056)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401238056', 'AMS2140 Analyzer', 'Emerson', 'B21401238056', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401238056', '2025-03-28', '2026-03-27', 'C03-202532', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401238057)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401238057', 'AMS2140 Analyzer', 'Emerson', 'B21401238057', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401238057', '2025-08-25', '2026-11-24', 'CP0051', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401238058)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401238058', 'AMS2140 Analyzer', 'Emerson', 'B21401238058', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401238058', '2025-10-31', '2026-10-30', 'C10-202540', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401248300)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401248300', 'AMS2140 Analyzer', 'Emerson', 'B21401248300', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401248300', '2025-07-04', '2026-07-03', 'C07-202501', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401248304)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401248304', 'AMS2140 Analyzer', 'Emerson', 'B21401248304', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401248304', '2025-09-03', '2026-09-02', 'C09-202502', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401248305)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401248305', 'AMS2140 Analyzer', 'Emerson', 'B21401248305', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401248305', '2025-07-04', '2026-07-03', 'C07-202502', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21401283996)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401283996', 'AMS2140 Analyzer', 'Emerson', 'B21401283996', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401283996', '2025-10-31', '2026-10-30', 'C10-202550', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21402258100)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21402258100', 'AMS2140 Analyzer', 'Emerson', 'B21402258100', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21402258100', '2025-08-21', '2026-08-21', 'CP0051', 'Valid', 'Emerson', NULL);

    -- AMS2140 Analyzer (B21402258101)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21402258101', 'AMS2140 Analyzer', 'Emerson', 'B21402258101', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21402258101', '2025-08-21', '2026-03-19', 'CP0051', 'Valid', 'Emerson', NULL);

    -- Digital Multimeter (30420018)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Equipment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-30420018', 'Digital Multimeter', 'Fluke', '30420018', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '30420018', '2025-02-05', '2026-02-05', '177176', 'Due Soon', 'Fluke', NULL);

    -- NOVA-PRO 300 AFG3021C ACT-3x (C0206541485411)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-C0206541485411', 'NOVA-PRO 300 AFG3021C ACT-3x', 'Tektronix Monarch', 'C0206541485411', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'C0206541485411', '2024-08-28', '2026-02-28', 'CAL-500-002', 'Valid', 'Tektronix Monarch', NULL);

    -- Waveform Generator 33500B (MY52100243)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Electrical / electronic test instrumentation' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-MY52100243', 'Waveform Generator 33500B', 'Agilent', 'MY52100243', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'MY52100243', '2025-01-23', '2026-01-23', '176515', 'Expired', 'Agilent', NULL);

    -- AMS2140 Analyzer (B21401248303)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B21401248303', 'AMS2140 Analyzer', 'Emerson', 'B21401248303', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B21401248303', '2025-07-07', '2026-07-07', 'CO7-202503', 'Valid', 'Emerson', NULL);

    -- Agilent 33210A (B2140140918)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-B2140140918', 'Agilent 33210A', 'Emerson', 'B2140140918', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, 'B2140140918', '2025-09-23', '2026-01-23', 'MHM-97905-PBF', 'Expired', 'Emerson', NULL);

    -- Fixturlaser M3 (87984)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-87984', 'Fixturlaser M3', 'Fixturlaser South Africa (Pty) Ltd', '87984', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '87984', '2024-04-29', '2025-04-29', '87984-20240429', 'Expired', 'Fixturlaser South Africa (Pty) Ltd', NULL);

    -- Fixturlaser M3 (87986)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-87986', 'Fixturlaser M3', 'Fixturlaser South Africa (Pty) Ltd', '87986', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '87986', '2024-04-29', '2025-04-29', '87986-20240429', 'Expired', 'Fixturlaser South Africa (Pty) Ltd', NULL);

    -- Fixturlaser M3 (87988)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-87988', 'Fixturlaser M3', 'Fixturlaser South Africa (Pty) Ltd', '87988', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '87988', '2024-04-29', '2025-04-29', '87988-20240429', 'Expired', 'Fixturlaser South Africa (Pty) Ltd', NULL);

    -- Fixturlaser S3 (97984)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-97984', 'Fixturlaser S3', 'Fixturlaser South Africa (Pty) Ltd', '97984', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '97984', '2024-04-29', '2025-04-29', '97984-20240429', 'Expired', 'Fixturlaser South Africa (Pty) Ltd', NULL);

    -- Fixturlaser S3 (97986)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-97986', 'Fixturlaser S3', 'Fixturlaser South Africa (Pty) Ltd', '97986', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '97986', '2024-04-29', '2025-04-29', '97986-20240429', 'Expired', 'Fixturlaser South Africa (Pty) Ltd', NULL);

    -- Fixturlaser S3 (97988)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-97988', 'Fixturlaser S3', 'Fixturlaser South Africa (Pty) Ltd', '97988', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '97988', '2024-04-29', '2025-04-29', '97988-20240429', 'Expired', 'Fixturlaser South Africa (Pty) Ltd', NULL);

    -- Flir E8 (63945556)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Equipment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-63945556', 'Flir E8', 'Flir', '63945556', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '63945556', '2024-10-21', '2025-10-21', '131315-2', 'Expired', 'Flir', NULL);

    -- Flir E54 (845009095)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Equipment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-845009095', 'Flir E54', 'Flir', '845009095', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '845009095', '2024-12-11', '2025-12-11', '131508-1', 'Expired', 'Flir', NULL);

    -- Flir E54 (84508577)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Equipment' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-84508577', 'Flir E54', 'Flir', '84508577', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '84508577', '2024-10-21', '2025-10-21', '131315-1', 'Expired', 'Flir', NULL);

    -- Portable Vibration Calibrator 9110D (11755)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Vibration Analysis' LIMIT 1;
    IF v_category_id IS NULL THEN v_category_id := 1; END IF;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;

node : 
At line:1 char:106
+ ... \database"; node generate_supabase_sql.js > supabase_setup.sql 2>&1;  ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
G�� SQL generated successfully!
    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)
    VALUES ('EQ-11755', 'Portable Vibration Calibrator 9110D', 'The Modal Shop', '11755', v_category_id, v_subcategory_id, 'Available')
    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number
    RETURNING id INTO v_equipment_db_id;

    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)
    VALUES (v_equipment_db_id, '11755', '2025-11-12', '2026-11-12', '2649.01', 'Valid', 'The Modal Shop', NULL);

END $$;

-- ============================================
-- ROW LEVEL SECURITY & POLICIES
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
   Personnel: 113 records
   Customers: 190 records
   Equipment + Calibration: 66 records
   Site locations: 25
