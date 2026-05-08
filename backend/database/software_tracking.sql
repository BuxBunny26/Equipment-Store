-- ============================================================
-- Software License Tracking Tables
-- Run this in the Supabase SQL Editor for project widwzjnfxhsxzhqrzthy
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS / DO blocks
-- ============================================================

-- ── Trigger function: auto-update updated_at ────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── software_licenses ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS software_licenses (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100)  NOT NULL,
    vendor          VARCHAR(100),
    license_type    VARCHAR(50)   NOT NULL DEFAULT 'Per User',
    cost_per_seat   NUMERIC(10,2) CHECK (cost_per_seat >= 0),
    billing_cycle   VARCHAR(20)   NOT NULL DEFAULT 'Monthly',
    total_seats     INTEGER       CHECK (total_seats > 0),
    renewal_date    DATE,
    notes           TEXT,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique name so ON CONFLICT (name) works in the seed below
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_software_licenses_name'
  ) THEN
    ALTER TABLE software_licenses ADD CONSTRAINT uq_software_licenses_name UNIQUE (name);
  END IF;
END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_software_licenses_updated_at ON software_licenses;
CREATE TRIGGER trg_software_licenses_updated_at
  BEFORE UPDATE ON software_licenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── software_assignments ────────────────────────────────────
CREATE TABLE IF NOT EXISTS software_assignments (
    id                  SERIAL PRIMARY KEY,
    software_license_id INTEGER   NOT NULL REFERENCES software_licenses(id) ON DELETE CASCADE,
    personnel_id        INTEGER   REFERENCES personnel(id) ON DELETE SET NULL,
    employee_name       VARCHAR(200),
    employee_id         VARCHAR(50),
    assigned_date       DATE      NOT NULL DEFAULT CURRENT_DATE,
    revoked_date        DATE,                          -- set when is_active flipped to false
    notes               TEXT,
    is_active           BOOLEAN   NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add revoked_date if table already existed without it
ALTER TABLE software_assignments ADD COLUMN IF NOT EXISTS revoked_date DATE;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_software_assignments_license_id
    ON software_assignments(software_license_id);

CREATE INDEX IF NOT EXISTS idx_software_assignments_personnel_id
    ON software_assignments(personnel_id);

-- Prevent the same employee being assigned the same software twice (active only)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_assignment
    ON software_assignments(software_license_id, personnel_id)
    WHERE is_active = TRUE AND personnel_id IS NOT NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_software_assignments_updated_at ON software_assignments;
CREATE TRIGGER trg_software_assignments_updated_at
  BEFORE UPDATE ON software_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Seed ────────────────────────────────────────────────────
INSERT INTO software_licenses (name, vendor, license_type, cost_per_seat, billing_cycle, total_seats, renewal_date, notes)
VALUES
  ('Microsoft 365 Business Standard',        'Microsoft', 'Per User', 209.55, 'Monthly',  97, NULL, 'Monthly billing, 365-day term. R20,326.35/month excl. VAT.'),
  ('Microsoft 365 E3',                       'Microsoft', 'Per User', 603.29, 'Monthly',  15, NULL, 'Monthly billing, 365-day term. R9,049.35/month excl. VAT.'),
  ('Microsoft 365 Business Premium',         'Microsoft', 'Per User', 368.68, 'Monthly',  23, NULL, 'Monthly billing, 365-day term. R8,479.64/month excl. VAT.'),
  ('Power BI Premium Per User',              'Microsoft', 'Per User', 402.19, 'Monthly',   7, NULL, 'Monthly billing, 365-day term. R2,815.33/month excl. VAT.'),
  ('Exchange Online Plan 1',                 'Microsoft', 'Per User',  67.03, 'Monthly',   4, NULL, 'Monthly billing, 365-day term. R268.12/month excl. VAT.'),
  ('Power Automate Per User',                'Microsoft', 'Per User', 251.37, 'Monthly',   1, NULL, 'Monthly billing, 365-day term. R251.37/month excl. VAT.'),
  ('Microsoft Defender for Office Plan 2',   'Microsoft', 'Per User',  83.79, 'Monthly', 130, NULL, 'Monthly billing, 365-day term. R10,892.70/month excl. VAT.'),
  ('Power Apps Per App Plan',                'Microsoft', 'Per User',  83.79, 'Monthly',   3, NULL, 'Monthly billing, 365-day term. R251.37/month excl. VAT.'),
  ('Adobe Acrobat Pro',       'Adobe',      'Per User', 220.00,  'Monthly', NULL, NULL, 'PDF editing and signing'),
  ('Zoho One',                'Zoho',       'Per User', 1470.00, 'Monthly',  45, '2026-06-07', 'Flexible User Pricing Plan. 45 users @ R1,470/seat = R66,150/month (excl. tax). Subscription ID: RPUS2005345172532'),
  ('Smartsheet',              'Smartsheet', 'Per User', 225.00,  'Monthly',  53, NULL, 'Business Plan. 54 active members against 53 licensed seats (1 over). R12,150/month.'),
  ('Zoho People',             'Zoho',       'Per User',  49.00,  'Monthly',  121, '2026-06-03', 'HR platform – Premium Plan. 121 seats @ R49/seat = R5,929/month (excl. tax). Subscription ID: RPUS2006773417247')
ON CONFLICT (name) DO NOTHING;

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE software_licenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON software_licenses    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON software_assignments FOR ALL USING (true) WITH CHECK (true);
