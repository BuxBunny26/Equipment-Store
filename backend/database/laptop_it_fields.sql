-- Laptop IT Department Fields Migration
-- Run this in Supabase SQL Editor

-- Account used for laptop setup (e.g. Microsoft account email)
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS setup_account VARCHAR(255);

-- Laptop PIN (sensitive - admin only visibility)
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS laptop_pin VARCHAR(50);

-- Phone number used for MFA
ALTER TABLE laptop_assignments ADD COLUMN IF NOT EXISTS mfa_phone VARCHAR(50);
