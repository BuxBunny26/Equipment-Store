-- Equipment Store Seed Data
-- Initial Categories, Subcategories, Locations, and Sample Personnel

-- ============================================
-- CATEGORIES
-- ============================================

INSERT INTO categories (name, is_checkout_allowed, is_consumable) VALUES
    ('Sensors & Measurement', TRUE, FALSE),
    ('Cables & Leads', TRUE, FALSE),
    ('Data Loggers & Instruments', TRUE, FALSE),
    ('Calibration & Alignment Tools', TRUE, FALSE),
    ('Power & Charging', TRUE, FALSE),
    ('Mounting & Accessories', TRUE, FALSE),
    ('IT & Computing Equipment', TRUE, FALSE),
    ('Hand Tools', TRUE, FALSE),
    ('Storage & Furniture', FALSE, FALSE),  -- Non-checkout
    ('Safety Equipment', TRUE, FALSE),
    ('Documentation & Media', FALSE, FALSE),  -- Non-checkout
    ('Consumables', TRUE, TRUE);  -- Consumable category

-- ============================================
-- SUBCATEGORIES
-- ============================================

-- Sensors & Measurement
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Sensors & Measurement'), 'Accelerometers'),
    ((SELECT id FROM categories WHERE name = 'Sensors & Measurement'), 'Vibration Sensors'),
    ((SELECT id FROM categories WHERE name = 'Sensors & Measurement'), 'Temperature Sensors'),
    ((SELECT id FROM categories WHERE name = 'Sensors & Measurement'), 'Pressure Sensors'),
    ((SELECT id FROM categories WHERE name = 'Sensors & Measurement'), 'Proximity Probes'),
    ((SELECT id FROM categories WHERE name = 'Sensors & Measurement'), 'Tachometers'),
    ((SELECT id FROM categories WHERE name = 'Sensors & Measurement'), 'Other Sensors');

-- Cables & Leads
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Cables & Leads'), 'BNC Cables'),
    ((SELECT id FROM categories WHERE name = 'Cables & Leads'), 'Accelerometer Cables'),
    ((SELECT id FROM categories WHERE name = 'Cables & Leads'), 'Extension Cables'),
    ((SELECT id FROM categories WHERE name = 'Cables & Leads'), 'USB Cables'),
    ((SELECT id FROM categories WHERE name = 'Cables & Leads'), 'Power Cables'),
    ((SELECT id FROM categories WHERE name = 'Cables & Leads'), 'Network Cables'),
    ((SELECT id FROM categories WHERE name = 'Cables & Leads'), 'Adapters & Connectors');

-- Data Loggers & Instruments
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Data Loggers & Instruments'), 'Vibration Analyzers'),
    ((SELECT id FROM categories WHERE name = 'Data Loggers & Instruments'), 'Data Collectors'),
    ((SELECT id FROM categories WHERE name = 'Data Loggers & Instruments'), 'Balancing Equipment'),
    ((SELECT id FROM categories WHERE name = 'Data Loggers & Instruments'), 'Alignment Systems'),
    ((SELECT id FROM categories WHERE name = 'Data Loggers & Instruments'), 'Thermal Cameras'),
    ((SELECT id FROM categories WHERE name = 'Data Loggers & Instruments'), 'Ultrasonic Detectors'),
    ((SELECT id FROM categories WHERE name = 'Data Loggers & Instruments'), 'Multimeters');

-- Calibration & Alignment Tools
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Calibration & Alignment Tools'), 'Calibration Standards'),
    ((SELECT id FROM categories WHERE name = 'Calibration & Alignment Tools'), 'Laser Alignment'),
    ((SELECT id FROM categories WHERE name = 'Calibration & Alignment Tools'), 'Dial Indicators'),
    ((SELECT id FROM categories WHERE name = 'Calibration & Alignment Tools'), 'Feeler Gauges'),
    ((SELECT id FROM categories WHERE name = 'Calibration & Alignment Tools'), 'Calibration Weights');

-- Power & Charging
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Power & Charging'), 'Battery Packs'),
    ((SELECT id FROM categories WHERE name = 'Power & Charging'), 'Chargers'),
    ((SELECT id FROM categories WHERE name = 'Power & Charging'), 'Power Supplies'),
    ((SELECT id FROM categories WHERE name = 'Power & Charging'), 'UPS Units'),
    ((SELECT id FROM categories WHERE name = 'Power & Charging'), 'Power Banks');

-- Mounting & Accessories
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Mounting & Accessories'), 'Magnetic Mounts'),
    ((SELECT id FROM categories WHERE name = 'Mounting & Accessories'), 'Tripods'),
    ((SELECT id FROM categories WHERE name = 'Mounting & Accessories'), 'Mounting Brackets'),
    ((SELECT id FROM categories WHERE name = 'Mounting & Accessories'), 'Cases & Bags'),
    ((SELECT id FROM categories WHERE name = 'Mounting & Accessories'), 'Straps & Holders');

-- IT & Computing Equipment
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'IT & Computing Equipment'), 'Laptops'),
    ((SELECT id FROM categories WHERE name = 'IT & Computing Equipment'), 'Tablets'),
    ((SELECT id FROM categories WHERE name = 'IT & Computing Equipment'), 'External Drives'),
    ((SELECT id FROM categories WHERE name = 'IT & Computing Equipment'), 'USB Drives'),
    ((SELECT id FROM categories WHERE name = 'IT & Computing Equipment'), 'Network Equipment'),
    ((SELECT id FROM categories WHERE name = 'IT & Computing Equipment'), 'Printers');

-- Hand Tools
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Hand Tools'), 'Screwdrivers'),
    ((SELECT id FROM categories WHERE name = 'Hand Tools'), 'Wrenches'),
    ((SELECT id FROM categories WHERE name = 'Hand Tools'), 'Pliers'),
    ((SELECT id FROM categories WHERE name = 'Hand Tools'), 'Hex Keys'),
    ((SELECT id FROM categories WHERE name = 'Hand Tools'), 'Torque Wrenches'),
    ((SELECT id FROM categories WHERE name = 'Hand Tools'), 'Tool Kits');

-- Storage & Furniture (Non-checkout)
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Storage & Furniture'), 'Cabinets'),
    ((SELECT id FROM categories WHERE name = 'Storage & Furniture'), 'Shelving'),
    ((SELECT id FROM categories WHERE name = 'Storage & Furniture'), 'Workbenches'),
    ((SELECT id FROM categories WHERE name = 'Storage & Furniture'), 'Storage Bins');

-- Safety Equipment
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Safety Equipment'), 'Hard Hats'),
    ((SELECT id FROM categories WHERE name = 'Safety Equipment'), 'Safety Glasses'),
    ((SELECT id FROM categories WHERE name = 'Safety Equipment'), 'Ear Protection'),
    ((SELECT id FROM categories WHERE name = 'Safety Equipment'), 'High-Vis Vests'),
    ((SELECT id FROM categories WHERE name = 'Safety Equipment'), 'Safety Boots'),
    ((SELECT id FROM categories WHERE name = 'Safety Equipment'), 'Gloves');

-- Documentation & Media (Non-checkout)
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Documentation & Media'), 'Manuals'),
    ((SELECT id FROM categories WHERE name = 'Documentation & Media'), 'Training Materials'),
    ((SELECT id FROM categories WHERE name = 'Documentation & Media'), 'Software Media'),
    ((SELECT id FROM categories WHERE name = 'Documentation & Media'), 'Reference Documents');

-- Consumables
INSERT INTO subcategories (category_id, name) VALUES
    ((SELECT id FROM categories WHERE name = 'Consumables'), 'Cleaning Supplies'),
    ((SELECT id FROM categories WHERE name = 'Consumables'), 'Lubricants'),
    ((SELECT id FROM categories WHERE name = 'Consumables'), 'Batteries'),
    ((SELECT id FROM categories WHERE name = 'Consumables'), 'Adhesives & Tapes'),
    ((SELECT id FROM categories WHERE name = 'Consumables'), 'Rags & Wipes'),
    ((SELECT id FROM categories WHERE name = 'Consumables'), 'Labels & Tags');

-- ============================================
-- LOCATIONS
-- ============================================

INSERT INTO locations (name, description) VALUES
    ('Main Store', 'Primary equipment storage location'),
    ('Secondary Store', 'Overflow equipment storage'),
    ('Office', 'Main office area'),
    ('Workshop', 'Equipment workshop and repair area'),
    ('Site - Mine A', 'Mining site A'),
    ('Site - Mine B', 'Mining site B'),
    ('Site - Plant 1', 'Processing plant 1'),
    ('Site - Plant 2', 'Processing plant 2'),
    ('Site - Refinery', 'Refinery location'),
    ('Site - Power Station', 'Power station location'),
    ('Client Site', 'Generic client site location'),
    ('In Transit', 'Equipment in transit between locations'),
    ('Calibration Lab', 'External calibration laboratory'),
    ('Repair - External', 'Sent for external repair');

-- ============================================
-- SAMPLE PERSONNEL
-- ============================================

INSERT INTO personnel (employee_id, full_name, email, department) VALUES
    ('EMP001', 'John Smith', 'john.smith@company.com', 'Vibration Analysis'),
    ('EMP002', 'Sarah Johnson', 'sarah.johnson@company.com', 'Vibration Analysis'),
    ('EMP003', 'Michael Brown', 'michael.brown@company.com', 'Thermography'),
    ('EMP004', 'Emily Davis', 'emily.davis@company.com', 'Oil Analysis'),
    ('EMP005', 'David Wilson', 'david.wilson@company.com', 'Field Services'),
    ('EMP006', 'Lisa Anderson', 'lisa.anderson@company.com', 'Field Services'),
    ('EMP007', 'Robert Taylor', 'robert.taylor@company.com', 'Engineering'),
    ('EMP008', 'Jennifer Martinez', 'jennifer.martinez@company.com', 'Training'),
    ('EMP009', 'William Garcia', 'william.garcia@company.com', 'IT'),
    ('EMP010', 'Store Admin', 'store@company.com', 'Store');

-- ============================================
-- SAMPLE EQUIPMENT (Optional - for testing)
-- ============================================

-- Sample serialised equipment
INSERT INTO equipment (
    equipment_id, equipment_name, description, 
    category_id, subcategory_id,
    is_serialised, serial_number,
    is_quantity_tracked, total_quantity, available_quantity,
    status, current_location_id
) VALUES
    ('EQP-001', 'SKF CMXA 80 Analyzer', 'Portable vibration analyzer with balancing capability',
     (SELECT id FROM categories WHERE name = 'Data Loggers & Instruments'),
     (SELECT id FROM subcategories WHERE name = 'Vibration Analyzers'),
     TRUE, 'SKF-2024-0001',
     FALSE, 1, 1,
     'Available', (SELECT id FROM locations WHERE name = 'Main Store')),
     
    ('EQP-002', 'FLIR E8 Thermal Camera', 'Infrared thermal imaging camera',
     (SELECT id FROM categories WHERE name = 'Data Loggers & Instruments'),
     (SELECT id FROM subcategories WHERE name = 'Thermal Cameras'),
     TRUE, 'FLIR-E8-2024-001',
     FALSE, 1, 1,
     'Available', (SELECT id FROM locations WHERE name = 'Main Store')),
     
    ('EQP-003', 'IMI 603C01 Accelerometer', 'Industrial accelerometer 100mV/g',
     (SELECT id FROM categories WHERE name = 'Sensors & Measurement'),
     (SELECT id FROM subcategories WHERE name = 'Accelerometers'),
     TRUE, 'IMI-603-0042',
     FALSE, 1, 1,
     'Available', (SELECT id FROM locations WHERE name = 'Main Store')),
     
    ('EQP-004', 'Dell Latitude 5540 Laptop', 'Field service laptop with analysis software',
     (SELECT id FROM categories WHERE name = 'IT & Computing Equipment'),
     (SELECT id FROM subcategories WHERE name = 'Laptops'),
     TRUE, 'DELL-LAT-2024-005',
     FALSE, 1, 1,
     'Available', (SELECT id FROM locations WHERE name = 'Main Store'));

-- Sample non-serialised equipment with quantity tracking
INSERT INTO equipment (
    equipment_id, equipment_name, description, 
    category_id, subcategory_id,
    is_serialised, serial_number,
    is_quantity_tracked, total_quantity, available_quantity, unit,
    status, current_location_id
) VALUES
    ('EQP-005', 'BNC Cable 2m', 'Standard BNC to BNC cable, 2 meter',
     (SELECT id FROM categories WHERE name = 'Cables & Leads'),
     (SELECT id FROM subcategories WHERE name = 'BNC Cables'),
     FALSE, NULL,
     TRUE, 20, 20, 'ea',
     'Available', (SELECT id FROM locations WHERE name = 'Main Store')),
     
    ('EQP-006', 'Magnetic Mount Base', 'Heavy duty magnetic sensor mount',
     (SELECT id FROM categories WHERE name = 'Mounting & Accessories'),
     (SELECT id FROM subcategories WHERE name = 'Magnetic Mounts'),
     FALSE, NULL,
     TRUE, 15, 15, 'ea',
     'Available', (SELECT id FROM locations WHERE name = 'Main Store'));

-- Sample consumables
INSERT INTO equipment (
    equipment_id, equipment_name, description, 
    category_id, subcategory_id,
    is_serialised, serial_number,
    is_quantity_tracked, total_quantity, available_quantity, unit, reorder_level,
    status, current_location_id
) VALUES
    ('CON-001', 'AA Batteries', 'Alkaline AA batteries for equipment',
     (SELECT id FROM categories WHERE name = 'Consumables'),
     (SELECT id FROM subcategories WHERE name = 'Batteries'),
     FALSE, NULL,
     TRUE, 100, 100, 'ea', 20,
     'Available', (SELECT id FROM locations WHERE name = 'Main Store')),
     
    ('CON-002', 'Sensor Cleaning Wipes', 'Lint-free cleaning wipes for sensors',
     (SELECT id FROM categories WHERE name = 'Consumables'),
     (SELECT id FROM subcategories WHERE name = 'Rags & Wipes'),
     FALSE, NULL,
     TRUE, 50, 50, 'pack', 10,
     'Available', (SELECT id FROM locations WHERE name = 'Main Store'));

-- Sample non-checkout item (Storage & Furniture)
INSERT INTO equipment (
    equipment_id, equipment_name, description, 
    category_id, subcategory_id,
    is_serialised, serial_number,
    is_quantity_tracked, total_quantity, available_quantity,
    status, current_location_id
) VALUES
    ('FUR-001', 'Equipment Cabinet A', 'Main equipment storage cabinet',
     (SELECT id FROM categories WHERE name = 'Storage & Furniture'),
     (SELECT id FROM subcategories WHERE name = 'Cabinets'),
     TRUE, 'CAB-STORE-001',
     FALSE, 1, 1,
     'Available', (SELECT id FROM locations WHERE name = 'Main Store'));
