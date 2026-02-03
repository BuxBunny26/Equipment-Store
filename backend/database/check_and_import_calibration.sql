-- Check and Import Calibration Records
-- Run this in Supabase SQL Editor

-- Step 1: Check if calibration_records table exists and has data
SELECT 'Current calibration_records count:' as info, COUNT(*) as count FROM calibration_records;

-- Step 2: Check equipment table has data  
SELECT 'Equipment count:' as info, COUNT(*) as count FROM equipment;

-- Step 3: Check some equipment serial numbers that should have calibration
SELECT id, serial_number, equipment_name 
FROM equipment 
WHERE serial_number IN ('03362', 'B21401216469', '55905783')
LIMIT 5;

-- If count is 0, run the imports below:

-- Clear and import calibration records
-- TRUNCATE TABLE calibration_records RESTART IDENTITY;

-- Sample insert to test - for serial number 03362 (Fixturlaser R2)
-- INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
-- SELECT id, '2025-05-05', '2027-05-01', '03362-20250506-43457', 'Fixturlaser South Africa (Pty) Ltd' 
-- FROM equipment WHERE serial_number = '03362';

-- Verify if it worked
-- SELECT cr.*, e.serial_number, e.equipment_name
-- FROM calibration_records cr
-- JOIN equipment e ON cr.equipment_id = e.id
-- LIMIT 5;
