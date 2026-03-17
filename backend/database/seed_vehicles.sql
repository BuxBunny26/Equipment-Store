-- Seed vehicle fleet data
-- Run this in Supabase SQL Editor after adding fuel_type and assigned_to columns

-- First, add the new columns if they don't exist yet
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(200);

-- Insert vehicle fleet register
INSERT INTO vehicles (registration_number, make, model, year, fuel_type, color, assigned_to, vehicle_status, notes)
VALUES
  ('BF88TVZN', 'Toyota', 'Fortuner 3.0D-4D', 2014, 'Diesel', 'White', 'Pool Vehicle', 'Active', 'Report shows pool vehicle assignment.'),
  ('BL67XDZN', 'Toyota', 'Hilux 2.7 VVTi RB S', 2018, 'Petrol', 'Black', 'Pool Vehicle', 'Active', 'Colour should be verified against source system.'),
  ('BL67XGZN', 'Toyota', 'Urban Cruiser 1.5 X', 2023, 'Petrol', 'White', 'Pool Vehicle', 'Active', 'Current report month January 2026.'),
  ('BL67XXZN', 'Toyota', 'Urban Cruiser 1.5 X', 2023, 'Petrol', 'White', 'Pool Vehicle', 'Active', 'Report month December 2025.'),
  ('BL67XZZN', 'Toyota', 'Hilux 2.4GD-6 4x4 D/C', 2024, 'Diesel', 'White', 'Pool Vehicle', 'Active', 'Double cab / 4x4 diesel unit.'),
  ('BR02GLZN', 'Toyota', 'Hilux 2.4 DC', 2024, 'Diesel', 'White', 'RS Pool Vehicle', 'Active', 'Same vehicle appears in two files for different reporting months.'),
  ('CM99YMZN', 'Toyota', 'Urban Cruiser 1.5 X', 2025, 'Petrol', 'White', 'RS Pool Vehicle', 'Active', 'Newer unit.'),
  ('CM99YVZN', 'Toyota', 'Urban Cruiser 1.5 X', 2025, 'Petrol', 'White', 'RS Pool Vehicle', 'Active', 'Newer unit.'),
  ('BL67XTZN', 'Toyota', 'Urban Cruiser 1.5 X', 2022, 'Petrol', 'White', 'RS Urban Pool 2', 'Active', 'Responsibility label differs from the others and should be standardised.'),
  ('NPN43679', 'Toyota', 'Hilux S/C', NULL, 'Petrol', 'White', 'Pool Vehicle', 'Active', 'Single cab Hilux. Used by Sipho Zwane, supervised by Francois Pienaar.'),
  ('N26078S', 'Toyota', 'Fortuner', NULL, 'Diesel', 'White', 'Pool Vehicle', 'Active', 'Additional Fortuner in fleet. Registration format differs from ZN plates.')
ON CONFLICT (registration_number) DO UPDATE SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  fuel_type = EXCLUDED.fuel_type,
  color = EXCLUDED.color,
  assigned_to = EXCLUDED.assigned_to,
  notes = EXCLUDED.notes;
