/**
 * Generate a complete SQL script for Supabase
 * Reads CSV/TSV data files and outputs INSERT statements
 * 
 * Usage: node generate_supabase_sql.js > supabase_setup.sql
 */

const fs = require('fs');
const path = require('path');

function cleanString(str) {
    if (!str) return null;
    const cleaned = str.trim();
    return cleaned === '' ? null : cleaned;
}

function escSql(str) {
    if (str === null || str === undefined) return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
}

function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
}

function parseTSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    const headers = lines[0].split('\t').map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = cleanString(values[idx]);
        });
        rows.push(row);
    }
    return rows;
}

function parseCSV(content, delimiter = ';') {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    let headerLine = lines[0];
    if (headerLine.startsWith('v')) headerLine = headerLine.substring(1);
    const headers = headerLine.split(delimiter).map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter);
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = cleanString(values[idx]);
        });
        rows.push(row);
    }
    return rows;
}

// Read data files
const employees = parseCSV(fs.readFileSync(path.join(__dirname, 'Employees Details.csv'), 'utf8'), ';');
const customers = parseTSV(fs.readFileSync(path.join(__dirname, 'customers.tsv'), 'utf8'));
const calibration = parseCSV(fs.readFileSync(path.join(__dirname, 'ARC Equipment Calibration Register.csv'), 'utf8'), ';');

let sql = '';

sql += `-- ============================================\n`;
sql += `-- SUPABASE COMPLETE SETUP SCRIPT\n`;
sql += `-- Generated: ${new Date().toISOString()}\n`;
sql += `-- \n`;
sql += `-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)\n`;
sql += `-- This creates all tables, inserts seed data, and creates RPC functions\n`;
sql += `-- ============================================\n\n`;

sql += `BEGIN;\n\n`;

// ============================================
// SCHEMA - Tables
// ============================================

sql += `-- ============================================\n`;
sql += `-- TABLES\n`;
sql += `-- ============================================\n\n`;

sql += `-- Categories\n`;
sql += `CREATE TABLE IF NOT EXISTS categories (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    name VARCHAR(100) NOT NULL UNIQUE,\n`;
sql += `    is_checkout_allowed BOOLEAN NOT NULL DEFAULT TRUE,\n`;
sql += `    is_consumable BOOLEAN NOT NULL DEFAULT FALSE,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `-- Subcategories\n`;
sql += `CREATE TABLE IF NOT EXISTS subcategories (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,\n`;
sql += `    name VARCHAR(100) NOT NULL,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    UNIQUE(category_id, name)\n`;
sql += `);\n\n`;

sql += `-- Locations\n`;
sql += `CREATE TABLE IF NOT EXISTS locations (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    name VARCHAR(100) NOT NULL UNIQUE,\n`;
sql += `    description VARCHAR(255),\n`;
sql += `    type VARCHAR(50) DEFAULT 'Site',\n`;
sql += `    customer_id INTEGER,\n`;
sql += `    is_active BOOLEAN NOT NULL DEFAULT TRUE,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `-- Personnel\n`;
sql += `CREATE TABLE IF NOT EXISTS personnel (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    employee_id VARCHAR(50) NOT NULL UNIQUE,\n`;
sql += `    first_name VARCHAR(100),\n`;
sql += `    last_name VARCHAR(100),\n`;
sql += `    full_name VARCHAR(200) NOT NULL,\n`;
sql += `    email VARCHAR(255),\n`;
sql += `    job_title VARCHAR(150),\n`;
sql += `    supervisor VARCHAR(200),\n`;
sql += `    site VARCHAR(100),\n`;
sql += `    department VARCHAR(100),\n`;
sql += `    division VARCHAR(100),\n`;
sql += `    is_active BOOLEAN NOT NULL DEFAULT TRUE,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `-- Customers\n`;
sql += `CREATE TABLE IF NOT EXISTS customers (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    customer_number VARCHAR(50) NOT NULL UNIQUE,\n`;
sql += `    display_name VARCHAR(255) NOT NULL,\n`;
sql += `    currency_code VARCHAR(10) DEFAULT 'ZAR',\n`;
sql += `    billing_city VARCHAR(100),\n`;
sql += `    billing_state VARCHAR(100),\n`;
sql += `    billing_country VARCHAR(100),\n`;
sql += `    shipping_city VARCHAR(100),\n`;
sql += `    shipping_state VARCHAR(100),\n`;
sql += `    shipping_country VARCHAR(100),\n`;
sql += `    tax_registration_number VARCHAR(50),\n`;
sql += `    vat_treatment VARCHAR(50),\n`;
sql += `    email VARCHAR(255),\n`;
sql += `    is_active BOOLEAN NOT NULL DEFAULT TRUE,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `-- Roles\n`;
sql += `CREATE TABLE IF NOT EXISTS roles (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    name VARCHAR(50) NOT NULL UNIQUE,\n`;
sql += `    permissions JSONB DEFAULT '{}',\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `-- Users\n`;
sql += `CREATE TABLE IF NOT EXISTS users (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    username VARCHAR(100) NOT NULL UNIQUE,\n`;
sql += `    email VARCHAR(255),\n`;
sql += `    full_name VARCHAR(200),\n`;
sql += `    password_hash VARCHAR(255),\n`;
sql += `    role_id INTEGER REFERENCES roles(id) DEFAULT 3,\n`;
sql += `    personnel_id INTEGER REFERENCES personnel(id),\n`;
sql += `    is_active BOOLEAN NOT NULL DEFAULT TRUE,\n`;
sql += `    last_login TIMESTAMPTZ,\n`;
sql += `    phone VARCHAR(50),\n`;
sql += `    department VARCHAR(100),\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `-- Equipment\n`;
sql += `CREATE TABLE IF NOT EXISTS equipment (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    equipment_id VARCHAR(50) NOT NULL UNIQUE,\n`;
sql += `    equipment_name VARCHAR(200) NOT NULL,\n`;
sql += `    description TEXT,\n`;
sql += `    category_id INTEGER REFERENCES categories(id),\n`;
sql += `    subcategory_id INTEGER REFERENCES subcategories(id),\n`;
sql += `    manufacturer VARCHAR(200),\n`;
sql += `    model VARCHAR(200),\n`;
sql += `    is_serialised BOOLEAN NOT NULL DEFAULT TRUE,\n`;
sql += `    serial_number VARCHAR(100),\n`;
sql += `    is_quantity_tracked BOOLEAN NOT NULL DEFAULT FALSE,\n`;
sql += `    total_quantity INTEGER DEFAULT 1,\n`;
sql += `    available_quantity INTEGER DEFAULT 1,\n`;
sql += `    unit VARCHAR(20) DEFAULT 'ea',\n`;
sql += `    reorder_level INTEGER DEFAULT 0,\n`;
sql += `    status VARCHAR(30) NOT NULL DEFAULT 'Available'\n`;
sql += `        CHECK (status IN ('Available', 'Checked Out', 'In Maintenance', 'Retired')),\n`;
sql += `    current_location_id INTEGER REFERENCES locations(id),\n`;
sql += `    current_holder_id INTEGER REFERENCES personnel(id),\n`;
sql += `    last_action VARCHAR(10) CHECK (last_action IN ('OUT', 'IN', 'ISSUE', 'RESTOCK')),\n`;
sql += `    last_action_timestamp TIMESTAMPTZ,\n`;
sql += `    next_maintenance_date DATE,\n`;
sql += `    notes TEXT,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `CREATE INDEX IF NOT EXISTS idx_equipment_serial ON equipment(serial_number);\n`;
sql += `CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);\n`;
sql += `CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category_id);\n\n`;

sql += `-- Calibration Records\n`;
sql += `CREATE TABLE IF NOT EXISTS calibration_records (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,\n`;
sql += `    serial_number VARCHAR(100),\n`;
sql += `    calibration_date DATE,\n`;
sql += `    expiry_date DATE,\n`;
sql += `    certificate_number VARCHAR(100),\n`;
sql += `    calibration_status VARCHAR(30) DEFAULT 'Valid'\n`;
sql += `        CHECK (calibration_status IN ('Valid', 'Due Soon', 'Expired', 'N/A')),\n`;
sql += `    calibration_provider VARCHAR(200),\n`;
sql += `    certificate_file_url TEXT,\n`;
sql += `    notes TEXT,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `CREATE INDEX IF NOT EXISTS idx_calibration_equipment ON calibration_records(equipment_id);\n`;
sql += `CREATE INDEX IF NOT EXISTS idx_calibration_expiry ON calibration_records(expiry_date);\n`;
sql += `CREATE INDEX IF NOT EXISTS idx_calibration_status ON calibration_records(calibration_status);\n`;
sql += `CREATE INDEX IF NOT EXISTS idx_calibration_serial ON calibration_records(serial_number);\n\n`;

sql += `-- Equipment Movements\n`;
sql += `CREATE TABLE IF NOT EXISTS equipment_movements (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    equipment_id INTEGER NOT NULL REFERENCES equipment(id),\n`;
sql += `    action VARCHAR(10) NOT NULL CHECK (action IN ('OUT', 'IN', 'ISSUE', 'RESTOCK')),\n`;
sql += `    quantity INTEGER DEFAULT 1,\n`;
sql += `    location_id INTEGER REFERENCES locations(id),\n`;
sql += `    personnel_id INTEGER REFERENCES personnel(id),\n`;
sql += `    customer_id INTEGER REFERENCES customers(id),\n`;
sql += `    photo_url TEXT,\n`;
sql += `    notes TEXT,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    created_by VARCHAR(100)\n`;
sql += `);\n\n`;

sql += `CREATE INDEX IF NOT EXISTS idx_movements_equipment ON equipment_movements(equipment_id);\n`;
sql += `CREATE INDEX IF NOT EXISTS idx_movements_created ON equipment_movements(created_at DESC);\n\n`;

sql += `-- Reservations\n`;
sql += `CREATE TABLE IF NOT EXISTS reservations (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    equipment_id INTEGER NOT NULL REFERENCES equipment(id),\n`;
sql += `    personnel_id INTEGER NOT NULL REFERENCES personnel(id),\n`;
sql += `    customer_id INTEGER REFERENCES customers(id),\n`;
sql += `    start_date DATE NOT NULL,\n`;
sql += `    end_date DATE NOT NULL,\n`;
sql += `    status VARCHAR(30) DEFAULT 'pending'\n`;
sql += `        CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),\n`;
sql += `    purpose TEXT,\n`;
sql += `    approved_by VARCHAR(100),\n`;
sql += `    approved_at TIMESTAMPTZ,\n`;
sql += `    notes TEXT,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `CREATE INDEX IF NOT EXISTS idx_reservations_equipment ON reservations(equipment_id);\n`;
sql += `CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(start_date, end_date);\n\n`;

sql += `-- Maintenance Types\n`;
sql += `CREATE TABLE IF NOT EXISTS maintenance_types (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    name VARCHAR(100) NOT NULL UNIQUE,\n`;
sql += `    is_active BOOLEAN NOT NULL DEFAULT TRUE,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `-- Maintenance Log\n`;
sql += `CREATE TABLE IF NOT EXISTS maintenance_log (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    equipment_id INTEGER NOT NULL REFERENCES equipment(id),\n`;
sql += `    maintenance_type_id INTEGER REFERENCES maintenance_types(id),\n`;
sql += `    maintenance_date DATE,\n`;
sql += `    completed_date DATE,\n`;
sql += `    description TEXT,\n`;
sql += `    performed_by VARCHAR(200),\n`;
sql += `    external_provider VARCHAR(200),\n`;
sql += `    cost DECIMAL(10, 2),\n`;
sql += `    cost_currency VARCHAR(10) DEFAULT 'ZAR',\n`;
sql += `    downtime_days INTEGER DEFAULT 0,\n`;
sql += `    next_maintenance_date DATE,\n`;
sql += `    status VARCHAR(30) DEFAULT 'scheduled'\n`;
sql += `        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),\n`;
sql += `    work_order_number VARCHAR(100),\n`;
sql += `    notes TEXT,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `CREATE INDEX IF NOT EXISTS idx_maintenance_equipment ON maintenance_log(equipment_id);\n\n`;

sql += `-- Equipment Images\n`;
sql += `CREATE TABLE IF NOT EXISTS equipment_images (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,\n`;
sql += `    filename VARCHAR(500),\n`;
sql += `    original_filename VARCHAR(500),\n`;
sql += `    file_path TEXT,\n`;
sql += `    file_size INTEGER,\n`;
sql += `    mime_type VARCHAR(100),\n`;
sql += `    caption TEXT,\n`;
sql += `    is_primary BOOLEAN DEFAULT FALSE,\n`;
sql += `    sort_order INTEGER DEFAULT 0,\n`;
sql += `    uploaded_by VARCHAR(100),\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `CREATE INDEX IF NOT EXISTS idx_images_equipment ON equipment_images(equipment_id);\n\n`;

sql += `-- Notifications\n`;
sql += `CREATE TABLE IF NOT EXISTS notifications (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    type VARCHAR(50) NOT NULL,\n`;
sql += `    title VARCHAR(200) NOT NULL,\n`;
sql += `    message TEXT,\n`;
sql += `    reference_type VARCHAR(50),\n`;
sql += `    reference_id INTEGER,\n`;
sql += `    user_id INTEGER REFERENCES users(id),\n`;
sql += `    is_read BOOLEAN DEFAULT FALSE,\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);\n`;
sql += `CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);\n\n`;

sql += `-- Audit Log\n`;
sql += `CREATE TABLE IF NOT EXISTS audit_log (\n`;
sql += `    id SERIAL PRIMARY KEY,\n`;
sql += `    table_name VARCHAR(100) NOT NULL,\n`;
sql += `    record_id INTEGER,\n`;
sql += `    action VARCHAR(20) NOT NULL,\n`;
sql += `    old_values JSONB,\n`;
sql += `    new_values JSONB,\n`;
sql += `    changed_by VARCHAR(100),\n`;
sql += `    changed_by_name VARCHAR(200),\n`;
sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);\n`;
sql += `CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id);\n`;
sql += `CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at DESC);\n\n`;

// ============================================
// TRIGGERS
// ============================================

sql += `-- ============================================\n`;
sql += `-- TRIGGERS\n`;
sql += `-- ============================================\n\n`;

sql += `CREATE OR REPLACE FUNCTION update_timestamp()\n`;
sql += `RETURNS TRIGGER AS $$\n`;
sql += `BEGIN\n`;
sql += `    NEW.updated_at = NOW();\n`;
sql += `    RETURN NEW;\n`;
sql += `END;\n`;
sql += `$$ LANGUAGE plpgsql;\n\n`;

const triggerTables = ['equipment', 'personnel', 'customers', 'calibration_records', 'categories', 'subcategories', 'locations', 'reservations', 'maintenance_log', 'users'];
for (const t of triggerTables) {
    sql += `DROP TRIGGER IF EXISTS trg_${t}_updated ON ${t};\n`;
    sql += `CREATE TRIGGER trg_${t}_updated BEFORE UPDATE ON ${t} FOR EACH ROW EXECUTE FUNCTION update_timestamp();\n`;
}
sql += '\n';

// ============================================
// SEED DATA
// ============================================

sql += `-- ============================================\n`;
sql += `-- SEED DATA: Categories\n`;
sql += `-- ============================================\n\n`;

sql += `INSERT INTO categories (name, is_checkout_allowed, is_consumable) VALUES\n`;
sql += `    ('Vibration Analysis', TRUE, FALSE),\n`;
sql += `    ('Laser Alignment', TRUE, FALSE),\n`;
sql += `    ('Thermal Equipment', TRUE, FALSE),\n`;
sql += `    ('Thermal Camera', TRUE, FALSE),\n`;
sql += `    ('Motor Circuit Analysis', TRUE, FALSE),\n`;
sql += `    ('Electrical / electronic test instrumentation', TRUE, FALSE),\n`;
sql += `    ('Consumables', TRUE, TRUE),\n`;
sql += `    ('Tools', TRUE, FALSE)\n`;
sql += `ON CONFLICT (name) DO NOTHING;\n\n`;

sql += `-- Subcategories\n`;
sql += `INSERT INTO subcategories (category_id, name) VALUES\n`;
sql += `    (1, 'Analyzers'), (1, 'Calibrators'),\n`;
sql += `    (2, 'Alignment Systems'), (2, 'Sensors'),\n`;
sql += `    (3, 'Thermal Cameras'), (3, 'Accessories'),\n`;
sql += `    (4, 'Handheld Cameras'),\n`;
sql += `    (5, 'MCA Testers'),\n`;
sql += `    (6, 'Multimeters'), (6, 'Signal Generators'),\n`;
sql += `    (7, 'General'), (8, 'General')\n`;
sql += `ON CONFLICT (category_id, name) DO NOTHING;\n\n`;

sql += `-- Branch locations\n`;
sql += `INSERT INTO locations (name, description, type) VALUES\n`;
sql += `    ('WearCheck - Longmeadow', 'Longmeadow Head Office Branch', 'Branch'),\n`;
sql += `    ('WearCheck - Springs', 'Springs Branch', 'Branch'),\n`;
sql += `    ('WearCheck - Westville', 'Westville Branch', 'Branch')\n`;
sql += `ON CONFLICT (name) DO NOTHING;\n\n`;

sql += `-- Roles\n`;
sql += `INSERT INTO roles (id, name, permissions) VALUES\n`;
sql += `    (1, 'admin', '{"all": true}'),\n`;
sql += `    (2, 'manager', '{"view": true, "edit": true, "checkout": true, "reports": true}'),\n`;
sql += `    (3, 'user', '{"view": true, "checkout": true}')\n`;
sql += `ON CONFLICT (name) DO NOTHING;\n\n`;

sql += `-- Maintenance Types\n`;
sql += `INSERT INTO maintenance_types (name) VALUES\n`;
sql += `    ('Preventive'), ('Corrective'), ('Calibration'),\n`;
sql += `    ('Inspection'), ('Cleaning'), ('Software Update'), ('Other')\n`;
sql += `ON CONFLICT (name) DO NOTHING;\n\n`;

// ============================================
// PERSONNEL DATA
// ============================================

sql += `-- ============================================\n`;
sql += `-- PERSONNEL DATA (${employees.length} employees)\n`;
sql += `-- ============================================\n\n`;

const sitesSet = new Set();

for (const emp of employees) {
    const employeeId = cleanString(emp['Employee Code']);
    const firstName = cleanString(emp['First Names']);
    const lastName = cleanString(emp['Surname']);
    const email = cleanString(emp['Company E-Mail']);
    const jobTitle = cleanString(emp['Job Title']);
    const supervisor = cleanString(emp['Direct Supervisor']);
    const site = cleanString(emp['Site']);
    const department = cleanString(emp['Department']);
    const division = cleanString(emp['Division']);

    if (!employeeId || employeeId === 'Unknown') continue;

    const fullName = [firstName, lastName].filter(Boolean).join(' ') || employeeId;
    
    if (site) sitesSet.add(site);

    sql += `INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)\n`;
    sql += `VALUES (${escSql(employeeId)}, ${escSql(firstName)}, ${escSql(lastName)}, ${escSql(fullName)}, ${escSql(email)}, ${escSql(jobTitle)}, ${escSql(supervisor)}, ${escSql(site)}, ${escSql(department)}, ${escSql(division)})\n`;
    sql += `ON CONFLICT (employee_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, job_title = EXCLUDED.job_title, supervisor = EXCLUDED.supervisor, site = EXCLUDED.site, department = EXCLUDED.department, division = EXCLUDED.division;\n\n`;
}

// Site locations from personnel
sql += `-- Site locations from personnel data\n`;
for (const site of [...sitesSet].sort()) {
    sql += `INSERT INTO locations (name, type) VALUES (${escSql(site)}, 'Site') ON CONFLICT (name) DO NOTHING;\n`;
}
sql += '\n';

// ============================================
// CUSTOMERS DATA
// ============================================

sql += `-- ============================================\n`;
sql += `-- CUSTOMERS DATA (${customers.length} customers)\n`;
sql += `-- ============================================\n\n`;

for (const c of customers) {
    const customerNumber = cleanString(c['Customer Number']);
    const displayName = cleanString(c['Display Name']);
    if (!customerNumber || !displayName) continue;

    sql += `INSERT INTO customers (customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email)\n`;
    sql += `VALUES (${escSql(customerNumber)}, ${escSql(displayName)}, ${escSql(c['Currency Code'] || 'ZAR')}, ${escSql(c['Billing City'])}, ${escSql(c['Billing State'])}, ${escSql(c['Billing Country'])}, ${escSql(c['Shipping City'])}, ${escSql(c['Shipping State'])}, ${escSql(c['Shipping Country'])}, ${escSql(c['Tax Registration Number'])}, ${escSql(c['VAT Treatment'])}, ${escSql(c['EmailID'])})\n`;
    sql += `ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name, currency_code = EXCLUDED.currency_code, billing_city = EXCLUDED.billing_city, billing_state = EXCLUDED.billing_state, billing_country = EXCLUDED.billing_country, email = EXCLUDED.email;\n\n`;
}

// ============================================
// EQUIPMENT & CALIBRATION DATA
// ============================================

sql += `-- ============================================\n`;
sql += `-- EQUIPMENT & CALIBRATION DATA (${calibration.length} items)\n`;
sql += `-- ============================================\n\n`;

// Category mapping for the calibration data
sql += `-- Insert equipment and calibration records using category lookups\n`;
sql += `DO $$\n`;
sql += `DECLARE\n`;
sql += `    v_category_id INTEGER;\n`;
sql += `    v_subcategory_id INTEGER;\n`;
sql += `    v_equipment_db_id INTEGER;\n`;
sql += `BEGIN\n\n`;

for (const row of calibration) {
    const category = cleanString(row['Equipment Category']);
    const equipmentName = cleanString(row['Equipment Name and Model']);
    const manufacturer = cleanString(row['OEM / Manufacturer']);
    const serialNumber = cleanString(row['Serial Number']);
    const calibrationDate = parseDate(row['Last Calibration Date']);
    const expiryDate = parseDate(row['Calibration Expiry Date']);
    const certificate = cleanString(row['Certificate']);
    const calibrationStatus = cleanString(row['Calibration Status']);
    const notes = cleanString(row['Notes']);

    if (!serialNumber || !equipmentName) continue;

    const equipmentId = `EQ-${serialNumber}`;

    sql += `    -- ${equipmentName} (${serialNumber})\n`;
    sql += `    SELECT id INTO v_category_id FROM categories WHERE name = ${escSql(category)} LIMIT 1;\n`;
    sql += `    IF v_category_id IS NULL THEN v_category_id := 1; END IF;\n`;
    sql += `    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;\n`;
    sql += `    IF v_subcategory_id IS NULL THEN v_subcategory_id := 1; END IF;\n\n`;

    sql += `    INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status)\n`;
    sql += `    VALUES (${escSql(equipmentId)}, ${escSql(equipmentName)}, ${escSql(manufacturer)}, ${escSql(serialNumber)}, v_category_id, v_subcategory_id, 'Available')\n`;
    sql += `    ON CONFLICT (equipment_id) DO UPDATE SET equipment_name = EXCLUDED.equipment_name, manufacturer = EXCLUDED.manufacturer, serial_number = EXCLUDED.serial_number\n`;
    sql += `    RETURNING id INTO v_equipment_db_id;\n\n`;

    sql += `    INSERT INTO calibration_records (equipment_id, serial_number, calibration_date, expiry_date, certificate_number, calibration_status, calibration_provider, notes)\n`;
    sql += `    VALUES (v_equipment_db_id, ${escSql(serialNumber)}, ${calibrationDate ? escSql(calibrationDate) : 'NULL'}, ${expiryDate ? escSql(expiryDate) : 'NULL'}, ${escSql(certificate)}, ${escSql(calibrationStatus)}, ${escSql(manufacturer)}, ${escSql(notes)});\n\n`;
}

sql += `END $$;\n\n`;

// ============================================
// RLS & POLICIES
// ============================================

sql += `-- ============================================\n`;
sql += `-- ROW LEVEL SECURITY & POLICIES\n`;
sql += `-- ============================================\n\n`;

const rlsTables = [
    'categories', 'subcategories', 'locations', 'personnel', 'customers',
    'equipment', 'equipment_movements', 'calibration_records', 'reservations',
    'notifications', 'audit_log', 'equipment_images', 'maintenance_log',
    'maintenance_types', 'roles', 'users'
];

for (const t of rlsTables) {
    sql += `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;\n`;
    sql += `DROP POLICY IF EXISTS "Allow all" ON ${t};\n`;
    sql += `CREATE POLICY "Allow all" ON ${t} FOR ALL USING (true) WITH CHECK (true);\n`;
}
sql += '\n';

sql += `COMMIT;\n`;

// Output
process.stdout.write(sql);
console.error(`\n✅ SQL generated successfully!`);
console.error(`   Personnel: ${employees.filter(e => cleanString(e['Employee Code']) && cleanString(e['Employee Code']) !== 'Unknown').length} records`);
console.error(`   Customers: ${customers.filter(c => cleanString(c['Customer Number']) && cleanString(c['Display Name'])).length} records`);
console.error(`   Equipment + Calibration: ${calibration.filter(r => cleanString(r['Serial Number']) && cleanString(r['Equipment Name and Model'])).length} records`);
console.error(`   Site locations: ${sitesSet.size}`);
