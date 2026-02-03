-- Re-import Calibration Records
-- Run this in Supabase SQL Editor

-- First, check if calibration_records table exists
-- If not, create it
CREATE TABLE IF NOT EXISTS calibration_records (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    calibration_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    certificate_number VARCHAR(255),
    calibration_provider VARCHAR(255),
    certificate_file_path VARCHAR(500),
    certificate_file_name VARCHAR(255),
    certificate_mime_type VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Clear existing calibration records (if any)
TRUNCATE TABLE calibration_records RESTART IDENTITY;

-- Import calibration records by matching serial numbers
-- Fixturlaser R2 - Serial 03362
INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider, notes)
SELECT id, '2025-05-05', '2027-05-01', '03362-20250506-43457', 'Fixturlaser South Africa (Pty) Ltd', NULL
FROM equipment WHERE serial_number = '03362';

-- Acoem S7 - Serial 41718
INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider, notes)
SELECT id, '2025-03-10', '2026-03-10', '41718-20250310', 'Acoem', NULL
FROM equipment WHERE serial_number = '41718';

-- Fixturlaser M3 - Serial 85889
INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider, notes)
SELECT id, '2025-05-05', '2027-05-01', '85889-20250505-43457', 'Fixturlaser South Africa (Pty) Ltd', NULL
FROM equipment WHERE serial_number = '85889';

-- Fixturlaser S3 - Serial 95889
INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider, notes)
SELECT id, '2025-05-05', '2027-05-01', '95889-20250505-43457', 'Fixturlaser South Africa (Pty) Ltd', NULL
FROM equipment WHERE serial_number = '95889';

-- Verify import
SELECT COUNT(*) as calibration_records_count FROM calibration_records;
