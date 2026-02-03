-- Re-import ALL Calibration Records
-- Run this in Supabase SQL Editor

-- First, ensure calibration_records table exists
CREATE TABLE IF NOT EXISTS calibration_records (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
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

-- Clear existing calibration records
TRUNCATE TABLE calibration_records RESTART IDENTITY;

-- Import all calibration records by matching serial numbers
-- Each INSERT finds equipment by serial_number and adds calibration record

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-05-05', '2027-05-01', '03362-20250506-43457', 'Fixturlaser South Africa (Pty) Ltd' FROM equipment WHERE serial_number = '03362';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-03-10', '2026-03-10', '41718-20250310', 'Acoem' FROM equipment WHERE serial_number = '41718';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-05-05', '2027-05-01', '85889-20250505-43457', 'Fixturlaser South Africa (Pty) Ltd' FROM equipment WHERE serial_number = '85889';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-05-05', '2027-05-01', '95889-20250505-43457', 'Fixturlaser South Africa (Pty) Ltd' FROM equipment WHERE serial_number = '95889';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-09-01', '2026-09-01', '135305-1', 'Repair and Metrology Services (Pty) Ltd' FROM equipment WHERE serial_number = '49002016';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-12-04', '2026-12-04', '1504250247 152 04', 'Hersteller' FROM equipment WHERE serial_number = '49004275';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-02-13', '2026-02-13', '49475264_ 2024_02_13', 'Hersteller' FROM equipment WHERE serial_number = '49022264';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-02-14', '2026-02-14', '49140800 2024_02_14', 'Hersteller' FROM equipment WHERE serial_number = '49110800';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-01-20', '2026-01-20', '132288-1', 'Flir' FROM equipment WHERE serial_number = '55905783';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-29', '2026-10-29', '136287-1', 'Flir' FROM equipment WHERE serial_number = '79302627';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-03-17', '2026-03-17', '132711-1', 'Flir' FROM equipment WHERE serial_number = '79318361';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-06-19', '2026-06-19', '134294-1', 'Flir' FROM equipment WHERE serial_number = '84510173';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-07-14', '2028-07-13', 'VC0000029', 'All Test Pro' FROM equipment WHERE serial_number = 'ATSX1119';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-02-03', '2026-02-03', 'TVC0000005', 'All Test Pro' FROM equipment WHERE serial_number = 'AT701667';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-11-12', '2026-11-12', 'PRD-P297', 'The Modal Shop' FROM equipment WHERE serial_number = '9110D';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202549', 'Emerson' FROM equipment WHERE serial_number = 'B2140140724';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202555', 'Emerson' FROM equipment WHERE serial_number = 'B2140140833';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202542', 'Emerson' FROM equipment WHERE serial_number = 'B21401150773';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-03-28', '2026-03-27', 'C03-202533', 'Emerson' FROM equipment WHERE serial_number = 'B21401161342';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-04-01', '2026-04-01', 'C04-202534', 'Emerson' FROM equipment WHERE serial_number = 'B21401172280';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202554', 'Emerson' FROM equipment WHERE serial_number = 'B21401172281';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202539', 'Emerson' FROM equipment WHERE serial_number = 'B21401183989';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-04-11', '2026-04-11', 'C04-202540', 'Emerson' FROM equipment WHERE serial_number = 'B21401195137';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202544', 'Emerson' FROM equipment WHERE serial_number = 'B21401216460';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202541', 'Emerson' FROM equipment WHERE serial_number = 'B21401216461';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202557', 'Emerson' FROM equipment WHERE serial_number = 'B21401216462';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202545', 'Emerson' FROM equipment WHERE serial_number = 'B21401216467';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202560', 'Emerson' FROM equipment WHERE serial_number = 'B21401216468';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-03-28', '2026-03-27', 'C03-202531', 'Emerson' FROM equipment WHERE serial_number = 'B21401216469';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202557', 'Emerson' FROM equipment WHERE serial_number = 'B21401216472';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202559', 'Emerson' FROM equipment WHERE serial_number = 'B21401216473';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202547', 'Emerson' FROM equipment WHERE serial_number = 'B21401216474';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-09-03', '2026-09-02', 'C09-202501', 'Emerson' FROM equipment WHERE serial_number = 'B21401216475';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202553', 'Emerson' FROM equipment WHERE serial_number = 'B21401216476';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202556', 'Emerson' FROM equipment WHERE serial_number = 'B21401216478';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202543', 'Emerson' FROM equipment WHERE serial_number = 'B21401216479';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202551', 'Emerson' FROM equipment WHERE serial_number = 'B21401216480';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202552', 'Emerson' FROM equipment WHERE serial_number = 'B21401216481';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202546', 'Emerson' FROM equipment WHERE serial_number = 'B21401237748';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-03-28', '2026-03-27', 'C03-202530', 'Emerson' FROM equipment WHERE serial_number = 'B21401237749';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-08-25', '2026-11-24', 'CP0051', 'Emerson' FROM equipment WHERE serial_number = 'B21401237750';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-03-29', '2026-03-28', 'C10-202548', 'Emerson' FROM equipment WHERE serial_number = 'B21401238055';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-03-28', '2026-03-27', 'C03-202532', 'Emerson' FROM equipment WHERE serial_number = 'B21401238056';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-08-25', '2026-11-24', 'CP0051', 'Emerson' FROM equipment WHERE serial_number = 'B21401238057';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202540', 'Emerson' FROM equipment WHERE serial_number = 'B21401238058';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-07-04', '2026-07-03', 'C07-202501', 'Emerson' FROM equipment WHERE serial_number = 'B21401248300';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-09-03', '2026-09-02', 'C09-202502', 'Emerson' FROM equipment WHERE serial_number = 'B21401248304';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-07-04', '2026-07-03', 'C07-202502', 'Emerson' FROM equipment WHERE serial_number = 'B21401248305';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-10-31', '2026-10-30', 'C10-202550', 'Emerson' FROM equipment WHERE serial_number = 'B21401283996';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-08-21', '2026-08-21', 'CP0051', 'Emerson' FROM equipment WHERE serial_number = 'B21402258100';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-08-21', '2026-03-19', 'CP0051', 'Emerson' FROM equipment WHERE serial_number = 'B21402258101';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-02-05', '2026-02-05', '177176', 'Fluke' FROM equipment WHERE serial_number = '30420018';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-08-28', '2026-02-28', 'CAL-500-002', 'Tektronix Monarch' FROM equipment WHERE serial_number = 'C0206541485411';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-01-23', '2026-01-23', '176515', 'Agilent' FROM equipment WHERE serial_number = 'MY52100243';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-07-07', '2026-07-07', 'CO7-202503', 'Emerson' FROM equipment WHERE serial_number = 'B21401248303';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-09-23', '2026-01-23', 'MHM-97905-PBF', 'Emerson' FROM equipment WHERE serial_number = 'B2140140918';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-04-29', '2025-04-29', '87984-20240429', 'Fixturlaser South Africa (Pty) Ltd' FROM equipment WHERE serial_number = '87984';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-04-29', '2025-04-29', '87986-20240429', 'Fixturlaser South Africa (Pty) Ltd' FROM equipment WHERE serial_number = '87986';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-04-29', '2025-04-29', '87988-20240429', 'Fixturlaser South Africa (Pty) Ltd' FROM equipment WHERE serial_number = '87988';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-04-29', '2025-04-29', '97984-20240429', 'Fixturlaser South Africa (Pty) Ltd' FROM equipment WHERE serial_number = '97984';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-04-29', '2025-04-29', '97986-20240429', 'Fixturlaser South Africa (Pty) Ltd' FROM equipment WHERE serial_number = '97986';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-04-29', '2025-04-29', '97988-20240429', 'Fixturlaser South Africa (Pty) Ltd' FROM equipment WHERE serial_number = '97988';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-10-21', '2025-10-21', '131315-2', 'Flir' FROM equipment WHERE serial_number = '63945556';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-12-11', '2025-12-11', '131508-1', 'Flir' FROM equipment WHERE serial_number = '845009095';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2024-10-21', '2025-10-21', '131315-1', 'Flir' FROM equipment WHERE serial_number = '84508577';

INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT id, '2025-11-12', '2026-11-12', '2649.01', 'The Modal Shop' FROM equipment WHERE serial_number = '11755';

-- Verify import
SELECT 'Imported ' || COUNT(*) || ' calibration records' as result FROM calibration_records;

-- Show calibration status summary
SELECT status, COUNT(*) as count
FROM (
    SELECT 
        CASE 
            WHEN expiry_date < CURRENT_DATE THEN 'Expired'
            WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
            ELSE 'Valid'
        END as status
    FROM calibration_records
) sub
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'Expired' THEN 1
        WHEN 'Due Soon' THEN 2
        ELSE 3
    END;
