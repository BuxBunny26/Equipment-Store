-- Vehicle Assignments Table
-- Tracks company vehicles assigned to technicians

CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    qr_code VARCHAR(100),
    make VARCHAR(100) NOT NULL,
    model VARCHAR(200) NOT NULL,
    registration_number VARCHAR(50) NOT NULL UNIQUE,
    year INTEGER,
    color VARCHAR(50),
    fuel_type VARCHAR(50),
    vin_number VARCHAR(50),
    assigned_to VARCHAR(200),
    vehicle_status VARCHAR(50) NOT NULL DEFAULT 'Active',
    license_disk_expiry DATE,
    registration_expiry DATE,
    next_service_date DATE,
    next_service_odometer INTEGER,
    current_odometer INTEGER DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON vehicles(registration_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(vehicle_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(is_active);

CREATE TRIGGER trg_vehicles_updated
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON vehicles
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Vehicle Checkouts (pre-trip inspection form)
-- Each time a driver takes a vehicle they fill this out
-- ============================================

CREATE TABLE IF NOT EXISTS vehicle_checkouts (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_name VARCHAR(200) NOT NULL,
    driver_license_number VARCHAR(50),
    driver_license_expiry DATE,
    supervisor VARCHAR(200),
    checkout_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    return_date TIMESTAMP,
    destination VARCHAR(300),
    reason_for_use VARCHAR(300),
    start_odometer INTEGER NOT NULL,
    end_odometer INTEGER,

    -- Pre-trip inspection checklist
    check_sanitized VARCHAR(20) DEFAULT 'N/A',
    check_bodywork VARCHAR(20) DEFAULT 'Good',
    check_tyres VARCHAR(20) DEFAULT 'Good',
    check_oil_water VARCHAR(20) DEFAULT 'Yes',
    check_fuel VARCHAR(20) DEFAULT 'Yes',
    check_first_auto_aa_cards VARCHAR(20) DEFAULT 'Yes',
    check_windscreen_wipers_mirrors VARCHAR(20) DEFAULT 'Good',
    check_lights VARCHAR(20) DEFAULT 'Yes',
    check_spare_tyre_jack VARCHAR(20) DEFAULT 'Yes',
    check_brakes VARCHAR(20) DEFAULT 'Yes',
    check_hooter VARCHAR(20) DEFAULT 'Yes',
    check_warning_triangle VARCHAR(20) DEFAULT 'Yes',
    check_license_disk VARCHAR(20) DEFAULT 'Yes',
    check_fire_extinguisher VARCHAR(20) DEFAULT 'Yes',
    check_first_aid_kit VARCHAR(20) DEFAULT 'Yes',
    check_warning_lights VARCHAR(20) DEFAULT 'Yes',
    check_wheel_chocks VARCHAR(20) DEFAULT 'N/A',

    vehicle_condition VARCHAR(50) DEFAULT 'Good',
    condition_notes TEXT,
    checks_not_performed_reason TEXT,
    first_aid_kit_contents VARCHAR(100),

    -- Driver change mid-trip
    driver_changed BOOLEAN DEFAULT FALSE,
    new_driver_name VARCHAR(200),
    new_driver_date TIMESTAMP,

    is_returned BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_checkouts_vehicle ON vehicle_checkouts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_checkouts_driver ON vehicle_checkouts(driver_name);
CREATE INDEX IF NOT EXISTS idx_vehicle_checkouts_date ON vehicle_checkouts(checkout_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_checkouts_returned ON vehicle_checkouts(is_returned);

CREATE TRIGGER trg_vehicle_checkouts_updated
    BEFORE UPDATE ON vehicle_checkouts
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

ALTER TABLE vehicle_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON vehicle_checkouts
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Vehicle Fines
-- ============================================

CREATE TABLE IF NOT EXISTS vehicle_fines (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_name VARCHAR(200) NOT NULL,
    fine_date DATE NOT NULL,
    fine_amount DECIMAL(10,2),
    fine_type VARCHAR(100),
    fine_reference VARCHAR(100),
    description TEXT,
    status VARCHAR(50) DEFAULT 'Unpaid',
    paid_date DATE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_fines_vehicle ON vehicle_fines(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_fines_driver ON vehicle_fines(driver_name);
CREATE INDEX IF NOT EXISTS idx_vehicle_fines_status ON vehicle_fines(status);

CREATE TRIGGER trg_vehicle_fines_updated
    BEFORE UPDATE ON vehicle_fines
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

ALTER TABLE vehicle_fines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON vehicle_fines
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Vehicle Service / Repair Records
-- ============================================

CREATE TABLE IF NOT EXISTS vehicle_services (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL DEFAULT 'Service',
    service_date DATE NOT NULL,
    odometer_at_service INTEGER,
    description TEXT,
    service_provider VARCHAR(200),
    cost DECIMAL(10,2),
    next_service_date DATE,
    next_service_odometer INTEGER,
    status VARCHAR(50) DEFAULT 'Completed',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_services_vehicle ON vehicle_services(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_services_type ON vehicle_services(service_type);

CREATE TRIGGER trg_vehicle_services_updated
    BEFORE UPDATE ON vehicle_services
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

ALTER TABLE vehicle_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON vehicle_services
    FOR ALL USING (true) WITH CHECK (true);
