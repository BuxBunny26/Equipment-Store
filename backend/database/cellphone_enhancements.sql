-- Cellphone Assignments Enhancement: Add cost, contract, warranty, SIM, and network fields
-- Run this in Supabase SQL Editor AFTER the initial cellphone_assignments.sql

-- Cost tracking
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS device_cost DECIMAL(10,2);
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2);

-- Contract & Warranty
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS warranty_end_date DATE;

-- SIM & Network
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS sim_number VARCHAR(50);
ALTER TABLE cellphone_assignments ADD COLUMN IF NOT EXISTS network_provider VARCHAR(50);
