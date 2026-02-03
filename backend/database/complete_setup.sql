-- ============================================
-- COMPLETE DATABASE SETUP FOR EQUIPMENT STORE
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: CREATE CORE TABLES
-- ============================================

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_checkout_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    is_consumable BOOLEAN NOT NULL DEFAULT FALSE,
    requires_calibration BOOLEAN NOT NULL DEFAULT FALSE,
    default_calibration_interval_months INTEGER DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subcategories Table
CREATE TABLE IF NOT EXISTS subcategories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, name)
);

-- Locations Table (should already exist)
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Personnel Table
CREATE TABLE IF NOT EXISTS personnel (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    department VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Equipment Table
CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    equipment_id VARCHAR(50) NOT NULL UNIQUE,
    equipment_name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    subcategory_id INTEGER NOT NULL REFERENCES subcategories(id),
    is_serialised BOOLEAN NOT NULL DEFAULT TRUE,
    serial_number VARCHAR(100),
    is_quantity_tracked BOOLEAN NOT NULL DEFAULT FALSE,
    total_quantity INTEGER DEFAULT 1,
    available_quantity INTEGER DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'ea',
    reorder_level INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'Available',
    current_location_id INTEGER REFERENCES locations(id),
    current_holder_id INTEGER REFERENCES personnel(id),
    current_customer_id INTEGER REFERENCES customers(id),
    last_action VARCHAR(20),
    last_action_timestamp TIMESTAMP,
    manufacturer VARCHAR(150),
    requires_calibration BOOLEAN DEFAULT NULL,
    calibration_interval_months INTEGER DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Equipment Movements Table
CREATE TABLE IF NOT EXISTS equipment_movements (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    quantity INTEGER DEFAULT 1,
    location_id INTEGER REFERENCES locations(id),
    customer_id INTEGER REFERENCES customers(id),
    personnel_id INTEGER REFERENCES personnel(id),
    notes TEXT,
    photo_file_path VARCHAR(500),
    photo_file_name VARCHAR(255),
    photo_mime_type VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Calibration Records Table
CREATE TABLE IF NOT EXISTS calibration_records (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    calibration_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    certificate_number VARCHAR(100),
    certificate_file_path VARCHAR(500),
    certificate_file_name VARCHAR(255),
    certificate_mime_type VARCHAR(100),
    calibration_provider VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- STEP 2: INSERT CATEGORIES
-- ============================================

INSERT INTO categories (name, is_checkout_allowed, is_consumable, requires_calibration, default_calibration_interval_months) VALUES
    ('Vibration Analysis', TRUE, FALSE, TRUE, 12),
    ('Laser Alignment', TRUE, FALSE, TRUE, 24),
    ('Thermal Equipment', TRUE, FALSE, TRUE, 12),
    ('Motor Circuit Analysis', TRUE, FALSE, TRUE, 12),
    ('Ultrasound', TRUE, FALSE, TRUE, 12),
    ('Balancing Equipment', TRUE, FALSE, TRUE, 12),
    ('NDT Equipment', TRUE, FALSE, TRUE, 12),
    ('General Tools', TRUE, FALSE, FALSE, NULL),
    ('Consumables', FALSE, TRUE, FALSE, NULL)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- STEP 3: INSERT SUBCATEGORIES
-- ============================================

INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Vibration Analysis'), 'Analyzers'),
    ((SELECT id FROM categories WHERE name = 'Vibration Analysis'), 'Sensors'),
    ((SELECT id FROM categories WHERE name = 'Vibration Analysis'), 'Calibrators'),
    ((SELECT id FROM categories WHERE name = 'Vibration Analysis'), 'Accessories'),
    ((SELECT id FROM categories WHERE name = 'Laser Alignment'), 'Shaft Alignment'),
    ((SELECT id FROM categories WHERE name = 'Laser Alignment'), 'Belt Alignment'),
    ((SELECT id FROM categories WHERE name = 'Laser Alignment'), 'Flatness'),
    ((SELECT id FROM categories WHERE name = 'Thermal Equipment'), 'Thermal Cameras'),
    ((SELECT id FROM categories WHERE name = 'Thermal Equipment'), 'IR Thermometers'),
    ((SELECT id FROM categories WHERE name = 'Motor Circuit Analysis'), 'MCA Testers'),
    ((SELECT id FROM categories WHERE name = 'Ultrasound'), 'Ultrasound Detectors'),
    ((SELECT id FROM categories WHERE name = 'Balancing Equipment'), 'Balancing Machines'),
    ((SELECT id FROM categories WHERE name = 'NDT Equipment'), 'Thickness Gauges'),
    ((SELECT id FROM categories WHERE name = 'NDT Equipment'), 'Flaw Detectors'),
    ((SELECT id FROM categories WHERE name = 'General Tools'), 'Hand Tools'),
    ((SELECT id FROM categories WHERE name = 'General Tools'), 'Power Tools'),
    ((SELECT id FROM categories WHERE name = 'Consumables'), 'Batteries'),
    ((SELECT id FROM categories WHERE name = 'Consumables'), 'Cables')
ON CONFLICT (category_id, name) DO NOTHING;

-- ============================================
-- STEP 4: INSERT LOCATIONS (if not already done)
-- ============================================

INSERT INTO locations (name, description, is_active) VALUES
    ('ARC Head Office - Longmeadow', 'WearCheck ARC Head Office, Longmeadow Business Estate', TRUE),
    ('ARC Springs', 'WearCheck ARC Springs Branch', TRUE),
    ('WearCheck KZN', 'WearCheck KwaZulu-Natal Branch', TRUE)
ON CONFLICT (name) DO UPDATE SET is_active = TRUE;

-- ============================================
-- STEP 5: CREATE CALIBRATION VIEW
-- ============================================

CREATE OR REPLACE VIEW v_equipment_calibration_status AS
WITH latest_calibration AS (
    SELECT DISTINCT ON (equipment_id)
        equipment_id,
        id AS calibration_record_id,
        calibration_date,
        expiry_date,
        certificate_number,
        certificate_file_path,
        calibration_provider
    FROM calibration_records
    ORDER BY equipment_id, calibration_date DESC, id DESC
),
equipment_cal_requirement AS (
    SELECT 
        e.id AS equipment_id,
        e.equipment_id AS equipment_code,
        e.equipment_name,
        e.manufacturer,
        e.serial_number,
        c.name AS category,
        s.name AS subcategory,
        COALESCE(e.requires_calibration, c.requires_calibration, FALSE) AS requires_calibration,
        COALESCE(e.calibration_interval_months, c.default_calibration_interval_months) AS calibration_interval_months
    FROM equipment e
    JOIN categories c ON e.category_id = c.id
    JOIN subcategories s ON e.subcategory_id = s.id
)
SELECT 
    ecr.equipment_id,
    ecr.equipment_code,
    ecr.equipment_name,
    ecr.manufacturer,
    ecr.serial_number,
    ecr.category,
    ecr.subcategory,
    ecr.requires_calibration,
    ecr.calibration_interval_months,
    lc.calibration_record_id,
    lc.calibration_date AS last_calibration_date,
    lc.expiry_date AS calibration_expiry_date,
    lc.certificate_number,
    lc.certificate_file_path,
    lc.calibration_provider,
    CASE 
        WHEN lc.expiry_date IS NOT NULL THEN 
            (lc.expiry_date - CURRENT_DATE)
        ELSE NULL
    END AS days_until_expiry,
    CASE
        WHEN NOT ecr.requires_calibration THEN 'N/A'
        WHEN lc.expiry_date IS NULL THEN 'Not Calibrated'
        WHEN lc.expiry_date < CURRENT_DATE THEN 'Expired'
        WHEN lc.expiry_date <= (CURRENT_DATE + INTERVAL '30 days') THEN 'Due Soon'
        ELSE 'Valid'
    END AS calibration_status
FROM equipment_cal_requirement ecr
LEFT JOIN latest_calibration lc ON ecr.equipment_id = lc.equipment_id;

-- ============================================
-- STEP 6: CREATE TRIGGER FOR EQUIPMENT STATUS
-- ============================================

CREATE OR REPLACE FUNCTION update_equipment_on_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.action = 'OUT' THEN
        UPDATE equipment SET 
            status = 'Checked Out',
            current_location_id = NEW.location_id,
            current_holder_id = NEW.personnel_id,
            current_customer_id = NEW.customer_id,
            last_action = 'OUT',
            last_action_timestamp = NEW.created_at,
            available_quantity = CASE WHEN is_quantity_tracked THEN available_quantity - NEW.quantity ELSE available_quantity END
        WHERE id = NEW.equipment_id;
    ELSIF NEW.action = 'IN' THEN
        UPDATE equipment SET 
            status = 'Available',
            current_location_id = NEW.location_id,
            current_holder_id = NULL,
            current_customer_id = NULL,
            last_action = 'IN',
            last_action_timestamp = NEW.created_at,
            available_quantity = CASE WHEN is_quantity_tracked THEN available_quantity + NEW.quantity ELSE available_quantity END
        WHERE id = NEW.equipment_id;
    ELSIF NEW.action = 'ISSUE' THEN
        UPDATE equipment SET 
            available_quantity = available_quantity - NEW.quantity,
            last_action = 'ISSUE',
            last_action_timestamp = NEW.created_at
        WHERE id = NEW.equipment_id;
    ELSIF NEW.action = 'RESTOCK' THEN
        UPDATE equipment SET 
            available_quantity = available_quantity + NEW.quantity,
            total_quantity = total_quantity + NEW.quantity,
            last_action = 'RESTOCK',
            last_action_timestamp = NEW.created_at
        WHERE id = NEW.equipment_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_equipment_movement ON equipment_movements;
CREATE TRIGGER trg_equipment_movement
    AFTER INSERT ON equipment_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_equipment_on_movement();

-- Show summary
SELECT 'Setup complete!' AS status;
SELECT 'Categories: ' || COUNT(*) FROM categories;
SELECT 'Subcategories: ' || COUNT(*) FROM subcategories;
SELECT 'Locations: ' || COUNT(*) FROM locations WHERE is_active = TRUE;
