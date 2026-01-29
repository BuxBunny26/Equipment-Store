-- ============================================
-- EQUIPMENT DATA IMPORT
-- Equipment with Valid Calibration Status
-- Import Date: January 2026
-- ============================================

-- This script imports equipment and their calibration records
-- Run AFTER calibration_schema.sql

-- ============================================
-- HELPER: Get or create equipment and return ID
-- ============================================

-- Temporary function to simplify inserts
CREATE OR REPLACE FUNCTION import_equipment_with_calibration(
    p_category_name VARCHAR,
    p_subcategory_name VARCHAR,
    p_equipment_name VARCHAR,
    p_manufacturer VARCHAR,
    p_serial_number VARCHAR,
    p_last_calibration DATE,
    p_calibration_expiry DATE,
    p_certificate_number VARCHAR,
    p_notes TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_equipment_id INTEGER;
    v_category_id INTEGER;
    v_subcategory_id INTEGER;
    v_equipment_code VARCHAR;
BEGIN
    -- Get category ID
    SELECT id INTO v_category_id FROM categories WHERE name = p_category_name;
    IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'Category not found: %', p_category_name;
    END IF;
    
    -- Get subcategory ID
    SELECT id INTO v_subcategory_id FROM subcategories 
    WHERE category_id = v_category_id AND name = p_subcategory_name;
    IF v_subcategory_id IS NULL THEN
        RAISE EXCEPTION 'Subcategory not found: % in category %', p_subcategory_name, p_category_name;
    END IF;
    
    -- Generate equipment code (prefix based on category + serial suffix)
    v_equipment_code := UPPER(LEFT(REPLACE(p_category_name, ' ', ''), 3)) || '-' || p_serial_number;
    
    -- Check if equipment already exists (by serial number)
    SELECT id INTO v_equipment_id FROM equipment WHERE serial_number = p_serial_number;
    
    IF v_equipment_id IS NULL THEN
        -- Insert new equipment
        INSERT INTO equipment (
            equipment_id,
            equipment_name,
            description,
            category_id,
            subcategory_id,
            is_serialised,
            serial_number,
            manufacturer,
            requires_calibration,
            status,
            notes
        ) VALUES (
            v_equipment_code,
            p_equipment_name,
            p_equipment_name || ' - ' || p_manufacturer,
            v_category_id,
            v_subcategory_id,
            TRUE,
            p_serial_number,
            p_manufacturer,
            TRUE,
            'Available',
            p_notes
        ) RETURNING id INTO v_equipment_id;
    ELSE
        -- Update existing equipment
        UPDATE equipment SET
            equipment_name = p_equipment_name,
            manufacturer = p_manufacturer,
            requires_calibration = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_equipment_id;
    END IF;
    
    -- Insert calibration record (if not already exists for this date)
    INSERT INTO calibration_records (
        equipment_id,
        calibration_date,
        expiry_date,
        certificate_number,
        calibration_provider,
        notes,
        created_by
    ) 
    SELECT 
        v_equipment_id,
        p_last_calibration,
        p_calibration_expiry,
        p_certificate_number,
        p_manufacturer,  -- Assuming manufacturer is calibration provider
        'Imported from calibration spreadsheet',
        'System Import'
    WHERE NOT EXISTS (
        SELECT 1 FROM calibration_records 
        WHERE equipment_id = v_equipment_id 
        AND calibration_date = p_last_calibration
        AND certificate_number = p_certificate_number
    );
    
    RETURN v_equipment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- IMPORT EQUIPMENT DATA
-- ============================================

-- Laser Alignment Equipment
SELECT import_equipment_with_calibration('Laser Alignment', 'Laser Alignment Systems', 'Fixturlaser R2', 'Fixturlaser South Africa (Pty) Ltd', '03362', '2025-05-05', '2027-05-01', '03362-20250506-43457');
SELECT import_equipment_with_calibration('Laser Alignment', 'Laser Alignment Systems', 'Acoem S7', 'Acoem', '41718', '2025-03-10', '2026-03-10', '41718-20250310');
SELECT import_equipment_with_calibration('Laser Alignment', 'Laser Alignment Systems', 'Fixturlaser M3', 'Fixturlaser South Africa (Pty) Ltd', '85889', '2025-05-05', '2027-05-01', '85889-20250505-43457');
SELECT import_equipment_with_calibration('Laser Alignment', 'Laser Alignment Systems', 'Fixturlaser S3', 'Fixturlaser South Africa (Pty) Ltd', '95889', '2025-05-05', '2027-05-01', '95889-20250505-43457');
SELECT import_equipment_with_calibration('Laser Alignment', 'Laser Alignment Systems', 'sensALIGN 7 Sensor', 'Hersteller', '49004275', '2024-12-04', '2026-12-04', '1504250247-152-04');
SELECT import_equipment_with_calibration('Laser Alignment', 'Laser Alignment Systems', 'sensALIGN 7 Sensor', 'Hersteller', '49022264', '2024-02-13', '2026-02-13', '49475264-2024_02_13');
SELECT import_equipment_with_calibration('Laser Alignment', 'Laser Alignment Systems', 'sensALIGN 7 Sensor', 'Hersteller', '49110800', '2024-02-14', '2026-02-14', '49140800-2024_02_14');

-- Thermal Camera
SELECT import_equipment_with_calibration('Thermal Camera', 'Thermal Imaging Cameras', 'Flir E40', 'Repair and Metrology Services (Pty) Ltd', '49002016', '2024-12-04', '2026-09-01', '135305-1');

-- Thermal Equipment
SELECT import_equipment_with_calibration('Thermal Equipment', 'Thermal Cameras', 'Flir T640', 'Flir', '55905783', '2025-01-20', '2026-01-20', '132288-1');
SELECT import_equipment_with_calibration('Thermal Equipment', 'Thermal Cameras', 'Flir T530', 'Flir', '79302027', '2025-10-29', '2026-10-29', '136287-1');
SELECT import_equipment_with_calibration('Thermal Equipment', 'Thermal Cameras', 'Flir T540', 'Flir', '79318361', '2025-03-17', '2026-03-19', '134045-1');
SELECT import_equipment_with_calibration('Thermal Equipment', 'Thermal Cameras', 'Flir E54', 'Flir', '84510173', '2025-06-19', '2026-06-19', '134294-1');
SELECT import_equipment_with_calibration('Thermal Equipment', 'Multimeters', 'Digital Multimeter', 'Fluke', '30420018', '2025-02-05', '2026-02-04', '177176');

-- Motor Circuit Analysis
SELECT import_equipment_with_calibration('Motor Circuit Analysis', 'Motor Testers', 'All Test Pro 5', 'All Test Pro', 'ATSX1119', '2025-07-14', '2028-07-13', 'VC0000029');
SELECT import_equipment_with_calibration('Motor Circuit Analysis', 'Motor Testers', 'ATTP MCA Tester', 'All Test Pro', 'AT701667', '2025-02-03', '2028-02-03', 'TVC0000005');

-- Vibration Analysis Equipment
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Calibrators', 'Portable Vibration Calibrator', 'The Model Shop', '9110D', '2025-11-12', '2026-11-12', 'PRD-P297');

-- Vibration Analyzers (AMS2140)
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B2140140724', '2025-10-31', '2026-10-30', 'C10-202549');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B2140140833', '2025-10-31', '2026-10-30', 'C10-202555');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401150773', '2025-10-31', '2028-10-30', 'C10-202542');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401161342', '2025-03-28', '2028-03-27', 'C03-202533');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401172280', '2025-04-01', '2026-04-01', 'C04-202534');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401172281', '2025-10-31', '2026-10-30', 'C10-202554');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401183989', '2025-10-31', '2026-10-30', 'C10-202539');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401195137', '2025-04-11', '2028-04-11', 'C04-202540');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216460', '2025-10-31', '2028-10-30', 'C10-202544');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216461', '2025-10-31', '2026-10-30', 'C10-202541');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216462', '2025-10-31', '2026-10-30', 'C10-202557');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216467', '2025-10-31', '2026-10-30', 'C10-202545');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216468', '2025-10-31', '2028-10-30', 'C10-202560');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216469', '2025-03-28', '2028-03-27', 'C03-202531');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216472', '2025-10-31', '2028-10-30', 'C10-202557');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216473', '2025-10-31', '2026-10-30', 'C10-202559');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216474', '2025-10-31', '2026-10-30', 'C10-202547');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216475', '2025-09-03', '2026-09-02', 'C09-202501');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216476', '2025-10-31', '2028-10-30', 'C10-202553');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216478', '2025-10-31', '2026-10-30', 'C10-202556');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216479', '2025-10-31', '2026-10-30', 'C10-202543');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216480', '2025-10-31', '2026-10-30', 'C10-202551');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401216481', '2025-10-31', '2026-10-30', 'C10-202552');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401237748', '2025-10-31', '2026-10-30', 'C10-202546');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401237749', '2025-03-28', '2028-03-27', 'C03-202530');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401237750', '2025-08-25', '2026-11-24', 'CP0051');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401238055', '2025-03-29', '2026-03-28', 'C10-202548');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401238056', '2025-03-28', '2028-03-27', 'C03-202532');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401238057', '2025-08-25', '2026-11-24', 'CP0051');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401238058', '2025-10-31', '2026-10-30', 'C10-202540');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401248300', '2025-07-04', '2026-07-03', 'C07-202501');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401248304', '2025-09-03', '2026-09-02', 'C09-202502');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401248305', '2025-07-04', '2026-07-03', 'C07-202502');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21401283996', '2025-10-31', '2026-10-30', 'C10-202550');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21402258100', '2025-08-21', '2026-08-21', 'CP0051');
SELECT import_equipment_with_calibration('Vibration Analysis', 'Vibration Analyzers', 'AMS2140 Analyzer', 'Emerson', 'B21402258101', '2025-08-21', '2026-03-19', 'CP0051');

-- Vibration Tachometer
SELECT import_equipment_with_calibration('Vibration Analysis', 'Tachometers', 'NOVA-PRO 300 AFG3021C', 'Tektronix Monarch', 'C0206541485411', '2024-08-28', '2026-02-28', 'CAL-500-002');

-- ============================================
-- CLEANUP: Drop temporary function
-- ============================================
DROP FUNCTION IF EXISTS import_equipment_with_calibration;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Show import summary
SELECT 
    'Equipment Imported' AS metric,
    COUNT(*) AS count
FROM equipment 
WHERE manufacturer IS NOT NULL;

-- Show calibration records imported
SELECT 
    'Calibration Records' AS metric,
    COUNT(*) AS count
FROM calibration_records;

-- Show calibration status summary
SELECT 
    calibration_status,
    COUNT(*) AS count
FROM v_equipment_calibration_status
WHERE requires_calibration = TRUE
GROUP BY calibration_status
ORDER BY 
    CASE calibration_status 
        WHEN 'Expired' THEN 1 
        WHEN 'Due Soon' THEN 2 
        WHEN 'Valid' THEN 3
        WHEN 'Not Calibrated' THEN 4
    END;

-- Show equipment due for calibration
SELECT 
    equipment_code,
    equipment_name,
    serial_number,
    manufacturer,
    calibration_expiry_date,
    days_until_expiry,
    calibration_status
FROM v_calibration_due
LIMIT 10;
