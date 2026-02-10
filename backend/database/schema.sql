-- Equipment Store Database Schema
-- PostgreSQL - Clean Setup
-- Run: psql -U postgres -d equipment_store -f schema.sql

-- ============================================
-- DROP EXISTING OBJECTS (clean install)
-- ============================================

-- Drop views first
DROP VIEW IF EXISTS v_calibration_status CASCADE;
DROP VIEW IF EXISTS v_equipment_overview CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_equipment_serial;
DROP INDEX IF EXISTS idx_equipment_status;
DROP INDEX IF EXISTS idx_equipment_category;
DROP INDEX IF EXISTS idx_calibration_equipment;
DROP INDEX IF EXISTS idx_calibration_expiry;
DROP INDEX IF EXISTS idx_calibration_status;
DROP INDEX IF EXISTS idx_calibration_serial;
DROP INDEX IF EXISTS idx_movements_equipment;
DROP INDEX IF EXISTS idx_movements_created;
DROP INDEX IF EXISTS idx_reservations_equipment;
DROP INDEX IF EXISTS idx_reservations_dates;
DROP INDEX IF EXISTS idx_maintenance_equipment;
DROP INDEX IF EXISTS idx_images_equipment;
DROP INDEX IF EXISTS idx_notifications_user;
DROP INDEX IF EXISTS idx_notifications_read;
DROP INDEX IF EXISTS idx_audit_table;
DROP INDEX IF EXISTS idx_audit_record;
DROP INDEX IF EXISTS idx_audit_time;

-- Drop triggers
DROP TRIGGER IF EXISTS trg_equipment_updated ON equipment;
DROP TRIGGER IF EXISTS trg_personnel_updated ON personnel;
DROP TRIGGER IF EXISTS trg_customers_updated ON customers;
DROP TRIGGER IF EXISTS trg_calibration_updated ON calibration_records;

-- Drop functions
DROP FUNCTION IF EXISTS update_timestamp CASCADE;

-- Drop tables
DROP TABLE IF EXISTS equipment_images CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS maintenance_records CASCADE;
DROP TABLE IF EXISTS calibration_records CASCADE;
DROP TABLE IF EXISTS equipment_movements CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS subcategories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS personnel CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- REFERENCE TABLES
-- ============================================

-- Categories Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_checkout_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    is_consumable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subcategories Table
CREATE TABLE subcategories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, name)
);

-- Locations Table
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    type VARCHAR(50) DEFAULT 'Site',
    customer_id INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Personnel Table (Employees)
CREATE TABLE personnel (
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Customers Table
CREATE TABLE customers (
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users Table (App Users)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    personnel_id INTEGER REFERENCES personnel(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EQUIPMENT TABLE
-- ============================================

CREATE TABLE equipment (
    id SERIAL PRIMARY KEY,
    equipment_id VARCHAR(50) NOT NULL UNIQUE,
    equipment_name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    subcategory_id INTEGER REFERENCES subcategories(id),
    
    -- Manufacturer & Model
    manufacturer VARCHAR(200),
    model VARCHAR(200),
    
    -- Serialisation
    is_serialised BOOLEAN NOT NULL DEFAULT TRUE,
    serial_number VARCHAR(100),
    
    -- Quantity tracking (for consumables)
    is_quantity_tracked BOOLEAN NOT NULL DEFAULT FALSE,
    total_quantity INTEGER DEFAULT 1,
    available_quantity INTEGER DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'ea',
    reorder_level INTEGER DEFAULT 0,
    
    -- Current State
    status VARCHAR(30) NOT NULL DEFAULT 'Available' 
        CHECK (status IN ('Available', 'Checked Out', 'In Maintenance', 'Retired')),
    current_location_id INTEGER REFERENCES locations(id),
    current_holder_id INTEGER REFERENCES personnel(id),
    last_action VARCHAR(10) CHECK (last_action IN ('OUT', 'IN', 'ISSUE', 'RESTOCK')),
    last_action_timestamp TIMESTAMP,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_equipment_serial ON equipment(serial_number);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_category ON equipment(category_id);

-- ============================================
-- CALIBRATION RECORDS
-- ============================================

CREATE TABLE calibration_records (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    serial_number VARCHAR(100),
    
    -- Calibration Details
    calibration_date DATE,
    expiry_date DATE,
    certificate_number VARCHAR(100),
    calibration_status VARCHAR(30) DEFAULT 'Valid'
        CHECK (calibration_status IN ('Valid', 'Due Soon', 'Expired', 'N/A')),
    
    -- Provider
    calibration_provider VARCHAR(200),
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_calibration_equipment ON calibration_records(equipment_id);
CREATE INDEX idx_calibration_expiry ON calibration_records(expiry_date);
CREATE INDEX idx_calibration_status ON calibration_records(calibration_status);
CREATE INDEX idx_calibration_serial ON calibration_records(serial_number);

-- ============================================
-- EQUIPMENT MOVEMENTS
-- ============================================

CREATE TABLE equipment_movements (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    action VARCHAR(10) NOT NULL CHECK (action IN ('OUT', 'IN', 'ISSUE', 'RESTOCK')),
    quantity INTEGER DEFAULT 1,
    location_id INTEGER REFERENCES locations(id),
    personnel_id INTEGER REFERENCES personnel(id),
    customer_id INTEGER REFERENCES customers(id),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

CREATE INDEX idx_movements_equipment ON equipment_movements(equipment_id);
CREATE INDEX idx_movements_created ON equipment_movements(created_at DESC);

-- ============================================
-- RESERVATIONS
-- ============================================

CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    personnel_id INTEGER NOT NULL REFERENCES personnel(id),
    customer_id INTEGER REFERENCES customers(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled')),
    purpose TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reservations_equipment ON reservations(equipment_id);
CREATE INDEX idx_reservations_dates ON reservations(start_date, end_date);

-- ============================================
-- MAINTENANCE RECORDS
-- ============================================

CREATE TABLE maintenance_records (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    maintenance_type VARCHAR(50) NOT NULL,
    description TEXT,
    performed_by VARCHAR(200),
    performed_date DATE,
    next_due_date DATE,
    cost DECIMAL(10, 2),
    status VARCHAR(30) DEFAULT 'Completed'
        CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_maintenance_equipment ON maintenance_records(equipment_id);

-- ============================================
-- EQUIPMENT IMAGES
-- ============================================

CREATE TABLE equipment_images (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type VARCHAR(50) DEFAULT 'photo',
    is_primary BOOLEAN DEFAULT FALSE,
    uploaded_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_images_equipment ON equipment_images(equipment_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    user_id INTEGER REFERENCES users(id),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER,
    action VARCHAR(20) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_record ON audit_log(record_id);
CREATE INDEX idx_audit_time ON audit_log(changed_at DESC);

-- ============================================
-- VIEWS
-- ============================================

-- Calibration Status Overview
CREATE OR REPLACE VIEW v_calibration_status AS
SELECT 
    e.id AS equipment_id,
    e.equipment_id AS equipment_code,
    e.equipment_name,
    e.serial_number,
    e.manufacturer,
    c.name AS category,
    cr.calibration_date,
    cr.expiry_date,
    cr.certificate_number,
    cr.calibration_status,
    CASE 
        WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
        WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
        ELSE 'Valid'
    END AS computed_status
FROM equipment e
LEFT JOIN calibration_records cr ON e.id = cr.equipment_id
LEFT JOIN categories c ON e.category_id = c.id;

-- Equipment Overview
CREATE OR REPLACE VIEW v_equipment_overview AS
SELECT 
    e.id,
    e.equipment_id,
    e.equipment_name,
    e.serial_number,
    e.manufacturer,
    e.status,
    c.name AS category,
    s.name AS subcategory,
    l.name AS current_location,
    p.full_name AS current_holder
FROM equipment e
LEFT JOIN categories c ON e.category_id = c.id
LEFT JOIN subcategories s ON e.subcategory_id = s.id
LEFT JOIN locations l ON e.current_location_id = l.id
LEFT JOIN personnel p ON e.current_holder_id = p.id;

-- ============================================
-- TRIGGER: Update equipment timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_equipment_updated 
    BEFORE UPDATE ON equipment 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_personnel_updated 
    BEFORE UPDATE ON personnel 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_customers_updated 
    BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_calibration_updated 
    BEFORE UPDATE ON calibration_records 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

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
    ('Tools', TRUE, FALSE);

-- Default subcategories
INSERT INTO subcategories (category_id, name) VALUES
    (1, 'Analyzers'),
    (1, 'Calibrators'),
    (2, 'Alignment Systems'),
    (2, 'Sensors'),
    (3, 'Thermal Cameras'),
    (3, 'Accessories'),
    (4, 'Handheld Cameras'),
    (5, 'MCA Testers'),
    (6, 'Multimeters'),
    (6, 'Signal Generators'),
    (7, 'General'),
    (8, 'General');

-- Branch locations
INSERT INTO locations (name, description, type) VALUES
    ('WearCheck - Longmeadow', 'Longmeadow Head Office Branch', 'Branch'),
    ('WearCheck - Springs', 'Springs Branch', 'Branch'),
    ('WearCheck - Westville', 'Westville Branch', 'Branch');

COMMIT;
