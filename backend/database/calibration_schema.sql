-- ============================================
-- CALIBRATION TRACKING SCHEMA EXTENSION
-- Run after schema.sql
-- ============================================

-- ============================================
-- ADD CALIBRATION FIELDS TO CATEGORIES
-- ============================================

-- Add requires_calibration flag to categories (default calibration requirement)
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS requires_calibration BOOLEAN NOT NULL DEFAULT FALSE;

-- Add default calibration interval (months) to categories
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS default_calibration_interval_months INTEGER DEFAULT NULL;

-- Update categories that typically require calibration
UPDATE categories SET requires_calibration = TRUE, default_calibration_interval_months = 12
WHERE name IN (
    'Sensors & Measurement',
    'Data Loggers & Instruments',
    'Calibration & Alignment Tools'
);

-- ============================================
-- ADD FIELDS TO EQUIPMENT TABLE
-- ============================================

-- Add manufacturer field
ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(150);

-- Add calibration-related fields (per-item override)
ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS requires_calibration BOOLEAN DEFAULT NULL;  -- NULL = inherit from category

ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS calibration_interval_months INTEGER DEFAULT NULL;  -- NULL = inherit from category

-- ============================================
-- CALIBRATION RECORDS TABLE (History Log)
-- ============================================

DROP TABLE IF EXISTS calibration_records CASCADE;

CREATE TABLE calibration_records (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    
    -- Calibration Details
    calibration_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    certificate_number VARCHAR(100),
    
    -- Certificate File Storage
    certificate_file_path VARCHAR(500),  -- Path to uploaded certificate file
    certificate_file_name VARCHAR(255),  -- Original filename
    certificate_mime_type VARCHAR(100),  -- e.g., 'application/pdf', 'image/jpeg'
    
    -- Calibration Provider
    calibration_provider VARCHAR(200),   -- Company/person who performed calibration
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX idx_calibration_equipment ON calibration_records(equipment_id);
CREATE INDEX idx_calibration_expiry ON calibration_records(expiry_date);
CREATE INDEX idx_calibration_date ON calibration_records(calibration_date DESC);

-- ============================================
-- VIEW: Current Calibration Status
-- Auto-calculates status based on expiry date
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
        -- Determine if calibration is required (equipment override > category default)
        COALESCE(e.requires_calibration, c.requires_calibration, FALSE) AS requires_calibration,
        -- Determine calibration interval (equipment override > category default)
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
    -- Calculate days until expiry
    CASE 
        WHEN lc.expiry_date IS NOT NULL THEN 
            (lc.expiry_date - CURRENT_DATE)
        ELSE NULL
    END AS days_until_expiry,
    -- Auto-calculate calibration status
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
-- VIEW: Equipment Due for Calibration
-- ============================================

CREATE OR REPLACE VIEW v_calibration_due AS
SELECT *
FROM v_equipment_calibration_status
WHERE requires_calibration = TRUE
    AND (calibration_status = 'Due Soon' 
         OR calibration_status = 'Expired' 
         OR calibration_status = 'Not Calibrated')
ORDER BY 
    CASE calibration_status 
        WHEN 'Expired' THEN 1 
        WHEN 'Due Soon' THEN 2 
        WHEN 'Not Calibrated' THEN 3 
    END,
    calibration_expiry_date ASC NULLS LAST;

-- ============================================
-- VIEW: Calibration History
-- ============================================

CREATE OR REPLACE VIEW v_calibration_history AS
SELECT 
    cr.id,
    e.equipment_id AS equipment_code,
    e.equipment_name,
    e.manufacturer,
    e.serial_number,
    c.name AS category,
    cr.calibration_date,
    cr.expiry_date,
    cr.certificate_number,
    cr.certificate_file_path,
    cr.certificate_file_name,
    cr.calibration_provider,
    cr.notes,
    cr.created_at,
    cr.created_by,
    -- Calculate if this was the valid calibration at time
    (cr.expiry_date - cr.calibration_date) AS calibration_validity_days
FROM calibration_records cr
JOIN equipment e ON cr.equipment_id = e.id
JOIN categories c ON e.category_id = c.id
ORDER BY e.equipment_id, cr.calibration_date DESC;

-- ============================================
-- FUNCTION: Get calibration status for equipment
-- ============================================

CREATE OR REPLACE FUNCTION get_calibration_status(p_equipment_id INTEGER)
RETURNS TABLE (
    calibration_status VARCHAR,
    last_calibration_date DATE,
    expiry_date DATE,
    days_until_expiry INTEGER,
    certificate_number VARCHAR,
    certificate_file_path VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.calibration_status::VARCHAR,
        v.last_calibration_date,
        v.calibration_expiry_date,
        v.days_until_expiry::INTEGER,
        v.certificate_number::VARCHAR,
        v.certificate_file_path::VARCHAR
    FROM v_equipment_calibration_status v
    WHERE v.equipment_id = p_equipment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Add new categories for the imported equipment
-- ============================================

-- Insert new categories if they don't exist
INSERT INTO categories (name, is_checkout_allowed, is_consumable, requires_calibration, default_calibration_interval_months) 
VALUES 
    ('Laser Alignment', TRUE, FALSE, TRUE, 12),
    ('Thermal Camera', TRUE, FALSE, TRUE, 12),
    ('Thermal Equipment', TRUE, FALSE, TRUE, 12),
    ('Motor Circuit Analysis', TRUE, FALSE, TRUE, 12),
    ('Vibration Analysis', TRUE, FALSE, TRUE, 12)
ON CONFLICT (name) DO UPDATE SET
    requires_calibration = EXCLUDED.requires_calibration,
    default_calibration_interval_months = EXCLUDED.default_calibration_interval_months;

-- ============================================
-- Add subcategories for the new categories
-- ============================================

-- Laser Alignment subcategories
INSERT INTO subcategories (category_id, name)
SELECT c.id, sub.name
FROM categories c
CROSS JOIN (VALUES 
    ('Laser Alignment Systems'),
    ('Alignment Accessories'),
    ('Alignment Software')
) AS sub(name)
WHERE c.name = 'Laser Alignment'
ON CONFLICT (category_id, name) DO NOTHING;

-- Thermal Camera subcategories
INSERT INTO subcategories (category_id, name)
SELECT c.id, sub.name
FROM categories c
CROSS JOIN (VALUES 
    ('Thermal Imaging Cameras'),
    ('Thermal Accessories')
) AS sub(name)
WHERE c.name = 'Thermal Camera'
ON CONFLICT (category_id, name) DO NOTHING;

-- Thermal Equipment subcategories
INSERT INTO subcategories (category_id, name)
SELECT c.id, sub.name
FROM categories c
CROSS JOIN (VALUES 
    ('Thermal Cameras'),
    ('Multimeters'),
    ('Temperature Measurement')
) AS sub(name)
WHERE c.name = 'Thermal Equipment'
ON CONFLICT (category_id, name) DO NOTHING;

-- Motor Circuit Analysis subcategories
INSERT INTO subcategories (category_id, name)
SELECT c.id, sub.name
FROM categories c
CROSS JOIN (VALUES 
    ('Motor Testers'),
    ('Circuit Analyzers'),
    ('Motor Accessories')
) AS sub(name)
WHERE c.name = 'Motor Circuit Analysis'
ON CONFLICT (category_id, name) DO NOTHING;

-- Vibration Analysis subcategories
INSERT INTO subcategories (category_id, name)
SELECT c.id, sub.name
FROM categories c
CROSS JOIN (VALUES 
    ('Vibration Analyzers'),
    ('Vibration Calibrators'),
    ('Vibration Accessories'),
    ('Tachometers')
) AS sub(name)
WHERE c.name = 'Vibration Analysis'
ON CONFLICT (category_id, name) DO NOTHING;
