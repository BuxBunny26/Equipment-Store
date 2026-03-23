-- Laptop Assignments Table
-- Tracks which employee has which company-provided laptop

CREATE TABLE IF NOT EXISTS laptop_assignments (
    id SERIAL PRIMARY KEY,
    employee_name VARCHAR(200) NOT NULL,
    employee_id VARCHAR(50),
    employee_email VARCHAR(255),
    laptop_brand VARCHAR(100) NOT NULL,
    laptop_model VARCHAR(200) NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    asset_tag VARCHAR(100),
    date_assigned DATE NOT NULL,
    date_returned DATE,
    laptop_status VARCHAR(50) NOT NULL DEFAULT 'Active',
    setup_laptop BOOLEAN NOT NULL DEFAULT FALSE,
    setup_m365 BOOLEAN NOT NULL DEFAULT FALSE,
    setup_adobe BOOLEAN NOT NULL DEFAULT FALSE,
    setup_zoho BOOLEAN NOT NULL DEFAULT FALSE,
    setup_smartsheet BOOLEAN NOT NULL DEFAULT FALSE,
    setup_distribution_lists BOOLEAN NOT NULL DEFAULT FALSE,
    device_cost DECIMAL(10,2),
    monthly_cost DECIMAL(10,2),
    warranty_end_date DATE,
    contract_start_date DATE,
    contract_end_date DATE,
    device_condition VARCHAR(20),
    accessories TEXT,
    insurance_policy VARCHAR(100),
    insurance_expiry DATE,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_laptop_assignments_employee ON laptop_assignments(employee_name);
CREATE INDEX IF NOT EXISTS idx_laptop_assignments_serial ON laptop_assignments(serial_number);
CREATE INDEX IF NOT EXISTS idx_laptop_assignments_active ON laptop_assignments(is_active);

-- Auto-update timestamp trigger
CREATE TRIGGER trg_laptop_assignments_updated
    BEFORE UPDATE ON laptop_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Enable Row Level Security
ALTER TABLE laptop_assignments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (matches existing RLS pattern)
CREATE POLICY "Allow all for authenticated users" ON laptop_assignments
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Laptop History Table (assignment change log)
-- ============================================

CREATE TABLE IF NOT EXISTS laptop_history (
    id SERIAL PRIMARY KEY,
    laptop_assignment_id INTEGER NOT NULL REFERENCES laptop_assignments(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    employee_name VARCHAR(200),
    employee_id VARCHAR(50),
    employee_email VARCHAR(255),
    laptop_status VARCHAR(50),
    notes TEXT,
    performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_laptop_history_assignment ON laptop_history(laptop_assignment_id);
CREATE INDEX IF NOT EXISTS idx_laptop_history_time ON laptop_history(performed_at);

ALTER TABLE laptop_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON laptop_history
    FOR ALL USING (true) WITH CHECK (true);
