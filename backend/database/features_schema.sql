-- ============================================
-- NEW FEATURES SCHEMA
-- Equipment Store Extended Features
-- ============================================

-- ============================================
-- 1. USER ROLES & PERMISSIONS (Must be created first)
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (name, description, permissions, is_system_role) VALUES 
    ('admin', 'Full system access', 
     '{"equipment": ["read", "write", "delete"], "movements": ["read", "write"], "calibration": ["read", "write"], "reports": ["read", "export"], "users": ["read", "write", "delete"], "settings": ["read", "write"], "audit": ["read"]}',
     TRUE),
    ('manager', 'Management access with approvals', 
     '{"equipment": ["read", "write"], "movements": ["read", "write"], "calibration": ["read", "write"], "reports": ["read", "export"], "users": ["read"], "settings": ["read"], "audit": ["read"]}',
     TRUE),
    ('technician', 'Standard user access', 
     '{"equipment": ["read"], "movements": ["read", "write"], "calibration": ["read"], "reports": ["read"], "users": [], "settings": [], "audit": []}',
     TRUE),
    ('viewer', 'Read-only access', 
     '{"equipment": ["read"], "movements": ["read"], "calibration": ["read"], "reports": ["read"], "users": [], "settings": [], "audit": []}',
     TRUE)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(200) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id) DEFAULT 3,
    personnel_id INTEGER REFERENCES personnel(id),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    avatar_url TEXT,
    phone VARCHAR(50),
    department VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_personnel ON users(personnel_id);

-- ============================================
-- 2. EQUIPMENT RESERVATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    personnel_id INTEGER NOT NULL REFERENCES personnel(id),
    customer_id INTEGER REFERENCES customers(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    purpose TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'active', 'completed', 'cancelled')),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    CONSTRAINT chk_reservation_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_reservations_equipment ON reservations(equipment_id);
CREATE INDEX IF NOT EXISTS idx_reservations_personnel ON reservations(personnel_id);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- ============================================
-- 3. NOTIFICATIONS / ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    email_enabled BOOLEAN DEFAULT TRUE,
    email_address VARCHAR(255),
    calibration_expiry_days INTEGER DEFAULT 30,
    calibration_alert_enabled BOOLEAN DEFAULT TRUE,
    overdue_checkout_alert_enabled BOOLEAN DEFAULT TRUE,
    overdue_checkout_days INTEGER DEFAULT 14,
    low_stock_alert_enabled BOOLEAN DEFAULT TRUE,
    reservation_alert_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50) NOT NULL 
        CHECK (type IN ('calibration_expiry', 'overdue_checkout', 'low_stock', 
                        'reservation_reminder', 'return_reminder', 'maintenance_due',
                        'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    is_email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ============================================
-- 4. EQUIPMENT MAINTENANCE LOG
-- ============================================

CREATE TABLE IF NOT EXISTS maintenance_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default maintenance types
INSERT INTO maintenance_types (name, description) VALUES 
    ('Repair', 'Equipment repair due to damage or malfunction'),
    ('Service', 'Scheduled preventive maintenance'),
    ('Cleaning', 'Cleaning and decontamination'),
    ('Software Update', 'Firmware or software updates'),
    ('Battery Replacement', 'Battery replacement or charging system service'),
    ('Accessory Replacement', 'Cables, probes, or other accessories replaced'),
    ('Inspection', 'General inspection and testing')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS maintenance_log (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    maintenance_type_id INTEGER NOT NULL REFERENCES maintenance_types(id),
    
    -- Maintenance details
    maintenance_date DATE NOT NULL,
    completed_date DATE,
    description TEXT NOT NULL,
    performed_by VARCHAR(200),
    external_provider VARCHAR(200),
    
    -- Costs
    cost DECIMAL(10, 2),
    cost_currency VARCHAR(3) DEFAULT 'ZAR',
    
    -- Downtime tracking
    downtime_days INTEGER DEFAULT 0,
    
    -- Next scheduled maintenance
    next_maintenance_date DATE,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    
    -- Documentation
    work_order_number VARCHAR(100),
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_equipment ON maintenance_log(equipment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON maintenance_log(maintenance_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_log(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_next ON maintenance_log(next_maintenance_date);

-- ============================================
-- 8. AUDIT TRAIL / CHANGE HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    
    -- What changed
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    
    -- Who changed it
    user_id INTEGER REFERENCES users(id),
    user_name VARCHAR(200),
    
    -- Change details
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[], -- Array of field names that changed
    
    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- ============================================
-- 6. EQUIPMENT IMAGE GALLERY
-- ============================================

CREATE TABLE IF NOT EXISTS equipment_images (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    
    -- Image details
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    
    -- Metadata
    caption TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    
    -- Who uploaded
    uploaded_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_images_equipment ON equipment_images(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_images_primary ON equipment_images(equipment_id, is_primary);

-- ============================================
-- ADD COLUMNS TO EXISTING TABLES
-- ============================================

-- Add next_maintenance_date to equipment table
ALTER TABLE equipment 
    ADD COLUMN IF NOT EXISTS next_maintenance_date DATE,
    ADD COLUMN IF NOT EXISTS maintenance_interval_days INTEGER,
    ADD COLUMN IF NOT EXISTS purchase_date DATE,
    ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS warranty_expiry DATE,
    ADD COLUMN IF NOT EXISTS asset_tag VARCHAR(100);

-- Create index for maintenance date
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_date ON equipment(next_maintenance_date);

-- ============================================
-- VIEWS FOR NEW FEATURES
-- ============================================

-- View: Active Reservations
CREATE OR REPLACE VIEW v_active_reservations AS
SELECT 
    r.id,
    r.equipment_id,
    e.equipment_id AS equipment_code,
    e.equipment_name,
    r.personnel_id,
    p.full_name AS personnel_name,
    r.customer_id,
    c.display_name AS customer_name,
    r.start_date,
    r.end_date,
    r.purpose,
    r.status,
    r.notes,
    r.created_at
FROM reservations r
JOIN equipment e ON r.equipment_id = e.id
JOIN personnel p ON r.personnel_id = p.id
LEFT JOIN customers c ON r.customer_id = c.id
WHERE r.status IN ('pending', 'approved', 'active')
ORDER BY r.start_date;

-- View: Equipment at Customer Sites
CREATE OR REPLACE VIEW v_equipment_at_customers AS
SELECT 
    e.id,
    e.equipment_id,
    e.equipment_name,
    e.serial_number,
    cat.name AS category,
    c.id AS customer_id,
    c.display_name AS customer_name,
    c.city,
    em.created_at AS checked_out_date,
    em.notes,
    p.full_name AS checked_out_by,
    CURRENT_DATE - em.created_at::date AS days_out
FROM equipment e
JOIN categories cat ON e.category_id = cat.id
JOIN equipment_movements em ON e.id = em.equipment_id
JOIN customers c ON em.customer_id = c.id
LEFT JOIN personnel p ON em.personnel_id = p.id
WHERE e.status = 'Checked Out'
  AND em.action = 'OUT'
  AND em.customer_id IS NOT NULL
  AND em.id = (
      SELECT MAX(id) FROM equipment_movements 
      WHERE equipment_id = e.id
  )
ORDER BY c.display_name, e.equipment_name;

-- View: Maintenance Due
CREATE OR REPLACE VIEW v_maintenance_due AS
SELECT 
    e.id,
    e.equipment_id,
    e.equipment_name,
    e.serial_number,
    cat.name AS category,
    e.next_maintenance_date,
    CASE 
        WHEN e.next_maintenance_date < CURRENT_DATE THEN 'Overdue'
        WHEN e.next_maintenance_date <= CURRENT_DATE + 30 THEN 'Due Soon'
        ELSE 'Scheduled'
    END AS maintenance_status,
    e.next_maintenance_date - CURRENT_DATE AS days_until_due
FROM equipment e
JOIN categories cat ON e.category_id = cat.id
WHERE e.next_maintenance_date IS NOT NULL
ORDER BY e.next_maintenance_date;

-- View: User with Roles
CREATE OR REPLACE VIEW v_users_with_roles AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    r.name AS role_name,
    r.permissions,
    u.is_active,
    u.last_login,
    u.department,
    p.employee_id,
    u.created_at
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN personnel p ON u.personnel_id = p.id
ORDER BY u.full_name;
