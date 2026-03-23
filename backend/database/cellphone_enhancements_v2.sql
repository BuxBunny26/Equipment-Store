-- Cellphone Assignments Enhancement v2: Add condition, accessories, insurance, data plan fields
-- Run this in Supabase SQL Editor AFTER cellphone_enhancements.sql

-- Data plan
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS data_plan VARCHAR(100);

-- Contract start date (v1 only had end date)
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS contract_start_date DATE;

-- Device condition tracking
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS device_condition VARCHAR(20);

-- Accessory tracking
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS accessories TEXT;

-- Insurance
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS insurance_policy VARCHAR(100);
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS insurance_expiry DATE;
