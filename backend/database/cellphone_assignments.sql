-- Cellphone Assignments Table
-- Tracks which employee has which company-provided cellphone

CREATE TABLE IF NOT EXISTS cellphone_assignments (
    id SERIAL PRIMARY KEY,
    employee_name VARCHAR(200) NOT NULL,
    employee_id VARCHAR(50),
    employee_email VARCHAR(255),
    phone_brand VARCHAR(100) NOT NULL,
    phone_model VARCHAR(200) NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    sim_number VARCHAR(100),
    imei_number VARCHAR(20),
    phone_number VARCHAR(30),
    asset_tag VARCHAR(100),
    network_provider VARCHAR(50),
    device_cost DECIMAL(10,2),
    monthly_cost DECIMAL(10,2),
    data_plan VARCHAR(100),
    contract_start_date DATE,
    contract_end_date DATE,
    warranty_end_date DATE,
    insurance_policy VARCHAR(100),
    insurance_expiry DATE,
    device_condition VARCHAR(20), -- Good/Fair/Poor/Damaged
    accessories TEXT, -- comma-separated: charger, case, screen protector, etc.
    date_assigned DATE NOT NULL,
    date_returned DATE,
    phone_status VARCHAR(50) NOT NULL DEFAULT 'Active',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_cellphone_assignments_employee ON cellphone_assignments(employee_name);
CREATE INDEX IF NOT EXISTS idx_cellphone_assignments_serial ON cellphone_assignments(serial_number);
CREATE INDEX IF NOT EXISTS idx_cellphone_assignments_active ON cellphone_assignments(is_active);

-- Auto-update timestamp trigger
CREATE TRIGGER trg_cellphone_assignments_updated
    BEFORE UPDATE ON cellphone_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Enable Row Level Security
ALTER TABLE cellphone_assignments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (matches existing RLS pattern)
CREATE POLICY "Allow all for authenticated users" ON cellphone_assignments
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Cellphone History Table (assignment change log)
-- ============================================

CREATE TABLE IF NOT EXISTS cellphone_history (
    id SERIAL PRIMARY KEY,
    cellphone_assignment_id INTEGER NOT NULL REFERENCES cellphone_assignments(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    employee_name VARCHAR(200),
    employee_id VARCHAR(50),
    employee_email VARCHAR(255),
    phone_status VARCHAR(50),
    notes TEXT,
    performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cellphone_history_assignment ON cellphone_history(cellphone_assignment_id);
CREATE INDEX IF NOT EXISTS idx_cellphone_history_time ON cellphone_history(performed_at);

ALTER TABLE cellphone_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON cellphone_history
    FOR ALL USING (true) WITH CHECK (true);
