-- Laptop Assignments Enhancements Migration
-- Run this in Supabase SQL Editor to add new columns to the existing table
-- Adds: cost tracking, warranty/contract, device condition, accessories, insurance

-- Cost tracking
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS device_cost DECIMAL(10,2);
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2);

-- Warranty and contract
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS warranty_end_date DATE;
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- Device condition and extras
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS device_condition VARCHAR(20);
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS accessories TEXT;
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS insurance_policy VARCHAR(100);
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS insurance_expiry DATE;

-- Indexes for new date columns
CREATE INDEX IF NOT EXISTS idx_laptop_assignments_warranty ON laptop_assignments(warranty_end_date);
CREATE INDEX IF NOT EXISTS idx_laptop_assignments_contract ON laptop_assignments(contract_end_date);
