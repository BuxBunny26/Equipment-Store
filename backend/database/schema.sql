-- Equipment Store Database Schema
-- PostgreSQL

-- Drop tables if exist (for clean reinstall)
DROP TABLE IF EXISTS equipment_movements CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS subcategories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS personnel CASCADE;

-- ============================================
-- REFERENCE TABLES
-- ============================================

-- Categories Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_checkout_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    is_consumable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subcategories Table (linked to categories)
CREATE TABLE subcategories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, name)
);

-- Locations Table
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Personnel Table (who can check out equipment)
CREATE TABLE personnel (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    department VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EQUIPMENT REGISTER (Master Table)
-- ============================================

CREATE TABLE equipment (
    id SERIAL PRIMARY KEY,
    equipment_id VARCHAR(50) NOT NULL UNIQUE,
    equipment_name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    subcategory_id INTEGER NOT NULL REFERENCES subcategories(id),
    
    -- Serialisation
    is_serialised BOOLEAN NOT NULL DEFAULT TRUE,
    serial_number VARCHAR(100),
    
    -- Quantity tracking (for non-serialised / consumables)
    is_quantity_tracked BOOLEAN NOT NULL DEFAULT FALSE,
    total_quantity INTEGER DEFAULT 1,
    available_quantity INTEGER DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'ea',
    reorder_level INTEGER DEFAULT 0,
    
    -- Current State (derived from movements, system-controlled)
    status VARCHAR(20) NOT NULL DEFAULT 'Available' 
        CHECK (status IN ('Available', 'Checked Out')),
    current_location_id INTEGER REFERENCES locations(id),
    current_holder_id INTEGER REFERENCES personnel(id),
    last_action VARCHAR(10) CHECK (last_action IN ('OUT', 'IN', 'ISSUE', 'RESTOCK')),
    last_action_timestamp TIMESTAMP,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_serialised_has_serial 
        CHECK (is_serialised = FALSE OR serial_number IS NOT NULL),
    CONSTRAINT chk_quantity_tracked_values
        CHECK (is_quantity_tracked = FALSE OR (total_quantity >= 0 AND available_quantity >= 0)),
    CONSTRAINT chk_available_lte_total
        CHECK (available_quantity <= total_quantity)
);

-- Unique serial number constraint (only when serial number is provided)
CREATE UNIQUE INDEX idx_unique_serial_number 
    ON equipment(serial_number) 
    WHERE serial_number IS NOT NULL;

-- ============================================
-- EQUIPMENT MOVEMENTS (Event Log - Append Only)
-- ============================================

CREATE TABLE equipment_movements (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    
    -- Action details
    action VARCHAR(10) NOT NULL 
        CHECK (action IN ('OUT', 'IN', 'ISSUE', 'RESTOCK')),
    quantity INTEGER DEFAULT 1,
    
    -- Location and Person
    location_id INTEGER REFERENCES locations(id),
    personnel_id INTEGER REFERENCES personnel(id),
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    
    -- Validation timestamp (system-generated)
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX idx_movements_equipment ON equipment_movements(equipment_id);
CREATE INDEX idx_movements_action ON equipment_movements(action);
CREATE INDEX idx_movements_personnel ON equipment_movements(personnel_id);
CREATE INDEX idx_movements_created ON equipment_movements(created_at DESC);

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- Currently Checked Out Equipment
CREATE OR REPLACE VIEW v_checked_out_equipment AS
SELECT 
    e.id,
    e.equipment_id,
    e.equipment_name,
    c.name AS category,
    s.name AS subcategory,
    e.serial_number,
    e.status,
    l.name AS current_location,
    p.full_name AS checked_out_to,
    p.employee_id AS holder_employee_id,
    e.last_action_timestamp AS checked_out_at,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - e.last_action_timestamp)) AS days_out
FROM equipment e
JOIN categories c ON e.category_id = c.id
JOIN subcategories s ON e.subcategory_id = s.id
LEFT JOIN locations l ON e.current_location_id = l.id
LEFT JOIN personnel p ON e.current_holder_id = p.id
WHERE e.status = 'Checked Out'
    AND c.is_consumable = FALSE;

-- Available Equipment
CREATE OR REPLACE VIEW v_available_equipment AS
SELECT 
    e.id,
    e.equipment_id,
    e.equipment_name,
    c.name AS category,
    s.name AS subcategory,
    e.serial_number,
    e.is_quantity_tracked,
    e.available_quantity,
    e.unit,
    l.name AS current_location
FROM equipment e
JOIN categories c ON e.category_id = c.id
JOIN subcategories s ON e.subcategory_id = s.id
LEFT JOIN locations l ON e.current_location_id = l.id
WHERE e.status = 'Available'
    AND c.is_consumable = FALSE;

-- Overdue Equipment (configurable threshold via application)
CREATE OR REPLACE VIEW v_overdue_equipment AS
SELECT 
    e.id,
    e.equipment_id,
    e.equipment_name,
    c.name AS category,
    s.name AS subcategory,
    e.serial_number,
    l.name AS current_location,
    p.full_name AS checked_out_to,
    p.email AS holder_email,
    e.last_action_timestamp AS checked_out_at,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - e.last_action_timestamp))::INTEGER AS days_overdue
FROM equipment e
JOIN categories c ON e.category_id = c.id
JOIN subcategories s ON e.subcategory_id = s.id
LEFT JOIN locations l ON e.current_location_id = l.id
LEFT JOIN personnel p ON e.current_holder_id = p.id
WHERE e.status = 'Checked Out'
    AND c.is_consumable = FALSE
    AND e.last_action_timestamp < (CURRENT_TIMESTAMP - INTERVAL '14 days');

-- Low Stock Consumables
CREATE OR REPLACE VIEW v_low_stock_consumables AS
SELECT 
    e.id,
    e.equipment_id,
    e.equipment_name,
    c.name AS category,
    s.name AS subcategory,
    e.available_quantity,
    e.total_quantity,
    e.reorder_level,
    e.unit
FROM equipment e
JOIN categories c ON e.category_id = c.id
JOIN subcategories s ON e.subcategory_id = s.id
WHERE c.is_consumable = TRUE
    AND e.available_quantity <= e.reorder_level;

-- Equipment Movement History
CREATE OR REPLACE VIEW v_movement_history AS
SELECT 
    m.id,
    m.equipment_id AS equipment_pk,
    e.equipment_id,
    e.equipment_name,
    m.action,
    m.quantity,
    l.name AS location,
    p.full_name AS personnel,
    p.employee_id AS personnel_employee_id,
    m.notes,
    m.created_at,
    m.created_by
FROM equipment_movements m
JOIN equipment e ON m.equipment_id = e.id
LEFT JOIN locations l ON m.location_id = l.id
LEFT JOIN personnel p ON m.personnel_id = p.id
ORDER BY m.created_at DESC;

-- ============================================
-- FUNCTIONS FOR STATE MANAGEMENT
-- ============================================

-- Function to update equipment state after movement
CREATE OR REPLACE FUNCTION update_equipment_state()
RETURNS TRIGGER AS $$
DECLARE
    v_category_is_consumable BOOLEAN;
    v_category_checkout_allowed BOOLEAN;
    v_current_status VARCHAR(20);
    v_is_quantity_tracked BOOLEAN;
    v_available_qty INTEGER;
    v_total_qty INTEGER;
BEGIN
    -- Get equipment and category info
    SELECT 
        e.status,
        e.is_quantity_tracked,
        e.available_quantity,
        e.total_quantity,
        c.is_consumable,
        c.is_checkout_allowed
    INTO 
        v_current_status,
        v_is_quantity_tracked,
        v_available_qty,
        v_total_qty,
        v_category_is_consumable,
        v_category_checkout_allowed
    FROM equipment e
    JOIN categories c ON e.category_id = c.id
    WHERE e.id = NEW.equipment_id;
    
    -- Validate based on action type
    IF NEW.action = 'OUT' THEN
        -- Equipment checkout validation
        IF v_category_is_consumable THEN
            RAISE EXCEPTION 'Cannot check out consumable items. Use ISSUE action instead.';
        END IF;
        
        IF NOT v_category_checkout_allowed THEN
            RAISE EXCEPTION 'Checkout is not allowed for this category.';
        END IF;
        
        IF v_current_status != 'Available' THEN
            RAISE EXCEPTION 'Equipment is not available for checkout. Current status: %', v_current_status;
        END IF;
        
        IF v_is_quantity_tracked THEN
            IF NEW.quantity > v_available_qty THEN
                RAISE EXCEPTION 'Insufficient quantity available. Requested: %, Available: %', NEW.quantity, v_available_qty;
            END IF;
            
            UPDATE equipment SET
                available_quantity = available_quantity - COALESCE(NEW.quantity, 1),
                status = CASE WHEN available_quantity - COALESCE(NEW.quantity, 1) = 0 THEN 'Checked Out' ELSE 'Available' END,
                current_location_id = NEW.location_id,
                current_holder_id = NEW.personnel_id,
                last_action = 'OUT',
                last_action_timestamp = NEW.created_at,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.equipment_id;
        ELSE
            UPDATE equipment SET
                status = 'Checked Out',
                current_location_id = NEW.location_id,
                current_holder_id = NEW.personnel_id,
                last_action = 'OUT',
                last_action_timestamp = NEW.created_at,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.equipment_id;
        END IF;
        
    ELSIF NEW.action = 'IN' THEN
        -- Equipment check-in validation
        IF v_category_is_consumable THEN
            RAISE EXCEPTION 'Cannot check in consumable items.';
        END IF;
        
        IF v_current_status != 'Checked Out' AND NOT v_is_quantity_tracked THEN
            RAISE EXCEPTION 'Equipment is not checked out. Current status: %', v_current_status;
        END IF;
        
        IF v_is_quantity_tracked THEN
            IF NEW.quantity > (v_total_qty - v_available_qty) THEN
                RAISE EXCEPTION 'Cannot return more than checked out. Max returnable: %', (v_total_qty - v_available_qty);
            END IF;
            
            UPDATE equipment SET
                available_quantity = available_quantity + COALESCE(NEW.quantity, 1),
                status = 'Available',
                current_location_id = NEW.location_id,
                current_holder_id = NULL,
                last_action = 'IN',
                last_action_timestamp = NEW.created_at,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.equipment_id;
        ELSE
            UPDATE equipment SET
                status = 'Available',
                current_location_id = NEW.location_id,
                current_holder_id = NULL,
                last_action = 'IN',
                last_action_timestamp = NEW.created_at,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.equipment_id;
        END IF;
        
    ELSIF NEW.action = 'ISSUE' THEN
        -- Consumable issue validation
        IF NOT v_category_is_consumable THEN
            RAISE EXCEPTION 'ISSUE action is only for consumables. Use OUT for equipment.';
        END IF;
        
        IF NEW.quantity > v_available_qty THEN
            RAISE EXCEPTION 'Insufficient stock. Requested: %, Available: %', NEW.quantity, v_available_qty;
        END IF;
        
        UPDATE equipment SET
            available_quantity = available_quantity - NEW.quantity,
            last_action = 'ISSUE',
            last_action_timestamp = NEW.created_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.equipment_id;
        
    ELSIF NEW.action = 'RESTOCK' THEN
        -- Consumable restock
        IF NOT v_category_is_consumable THEN
            RAISE EXCEPTION 'RESTOCK action is only for consumables.';
        END IF;
        
        UPDATE equipment SET
            available_quantity = available_quantity + NEW.quantity,
            total_quantity = total_quantity + NEW.quantity,
            last_action = 'RESTOCK',
            last_action_timestamp = NEW.created_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.equipment_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run state update after movement insert
CREATE TRIGGER trg_update_equipment_state
    AFTER INSERT ON equipment_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_equipment_state();

-- Prevent updates and deletes on movements (append-only)
CREATE OR REPLACE FUNCTION prevent_movement_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Movement records cannot be modified or deleted. They are append-only.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_movement_update
    BEFORE UPDATE ON equipment_movements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_movement_modification();

CREATE TRIGGER trg_prevent_movement_delete
    BEFORE DELETE ON equipment_movements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_movement_modification();
