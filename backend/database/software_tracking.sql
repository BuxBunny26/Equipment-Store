-- ============================================================
-- Software License Tracking Tables
-- Run this in the Supabase SQL Editor for project widwzjnfxhsxzhqrzthy
-- ============================================================

-- Software catalog (master list of software products)
CREATE TABLE IF NOT EXISTS software_licenses (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    vendor          VARCHAR(100),
    license_type    VARCHAR(50) NOT NULL DEFAULT 'Per User',
    cost_per_seat   NUMERIC(10,2),
    billing_cycle   VARCHAR(20) NOT NULL DEFAULT 'Monthly',
    total_seats     INTEGER,
    renewal_date    DATE,
    notes           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Assignments of software to employees
CREATE TABLE IF NOT EXISTS software_assignments (
    id                  SERIAL PRIMARY KEY,
    software_license_id INTEGER NOT NULL REFERENCES software_licenses(id) ON DELETE CASCADE,
    personnel_id        INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
    employee_name       VARCHAR(200),
    employee_id         VARCHAR(50),
    assigned_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    notes               TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Optional: seed with known software products
INSERT INTO software_licenses (name, vendor, license_type, cost_per_seat, billing_cycle, notes)
VALUES
  ('Microsoft 365 Business', 'Microsoft', 'Per User', 219.00, 'Monthly', 'M365 Business Standard'),
  ('Adobe Acrobat Pro', 'Adobe', 'Per User', 220.00, 'Monthly', 'PDF editing and signing'),
  ('Zoho One', 'Zoho', 'Per User', 185.00, 'Monthly', 'Zoho suite'),
  ('Smartsheet', 'Smartsheet', 'Per User', 250.00, 'Monthly', 'Project / work management')
ON CONFLICT DO NOTHING;

-- Enable RLS and allow all (matches existing table setup)
ALTER TABLE software_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON software_licenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON software_assignments FOR ALL USING (true) WITH CHECK (true);
