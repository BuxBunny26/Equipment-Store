-- Seed vehicle fleet data
-- Run this in Supabase SQL Editor after adding fuel_type and assigned_to columns

-- First, add the new columns if they don't exist yet
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(200);

-- Insert vehicle fleet register (assigned_to = last driver, current_odometer = last reading)
INSERT INTO vehicles (registration_number, make, model, year, fuel_type, color, assigned_to, current_odometer, vehicle_status, notes)
VALUES
  ('BF88TVZN', 'Toyota', 'Fortuner 3.0D-4D', 2014, 'Diesel', 'White', 'Allan Stuurman', 520923, 'Active', 'Last checkout 2026-03-17. Supervisor: Eddie Pieterse Jnr.'),
  ('BL67XDZN', 'Toyota', 'Hilux 2.7 VVTi RB S', 2018, 'Petrol', 'Black', 'Pool Vehicle', 0, 'Active', 'No 2026 checkouts recorded yet.'),
  ('BL67XGZN', 'Toyota', 'Urban Cruiser 1.5 X', 2023, 'Petrol', 'White', 'Daniel Molapo', 89134, 'Active', 'Last checkout 2026-03-07. Supervisor: Edward Pieterse Snr.'),
  ('BL67XXZN', 'Toyota', 'Urban Cruiser 1.5 X', 2023, 'Petrol', 'White', 'Pool Vehicle', 0, 'Active', 'No 2026 checkouts recorded yet.'),
  ('BL67XZZN', 'Toyota', 'Hilux 2.4GD-6 4x4 D/C', 2024, 'Diesel', 'White', 'Micheal Masemola', 90475, 'Active', 'Last checkout 2026-03-17. Supervisor: Eddie Pieterse Jnr.'),
  ('BR02GLZN', 'Toyota', 'Hilux 2.4 DC', 2024, 'Diesel', 'White', 'Mariette du Rand', 71275, 'Active', 'Last checkout 2026-03-10. Supervisor: Megan.'),
  ('CM99YMZN', 'Toyota', 'Urban Cruiser 1.5 X', 2025, 'Petrol', 'White', 'Jaco de Beer', 28263, 'Active', 'Last checkout 2026-02-17. Supervisor: Eben Prinsloo.'),
  ('CM99YVZN', 'Toyota', 'Urban Cruiser 1.5 X', 2025, 'Petrol', 'White', 'RS Pool Vehicle', 0, 'Active', 'No 2026 checkouts recorded yet.'),
  ('BL67XTZN', 'Toyota', 'Urban Cruiser 1.5 X', 2022, 'Petrol', 'White', 'Sergent Thlou', 112536, 'Active', 'Last checkout 2026-02-12. Supervisor: martin.'),
  ('NPN43679', 'Toyota', 'Hilux S/C', NULL, 'Petrol', 'White', 'Sipho Zwane', 528127, 'Active', 'Last checkout 2026-03-12. Supervisor: Francois Pienaar.'),
  ('N26078S', 'Toyota', 'Fortuner', NULL, 'Diesel', 'White', 'Labby Jeffrey Lubis', 519917, 'Active', 'Last checkout 2026-02-23. Supervisor: Eddie Pieterse Jnr.')
ON CONFLICT (registration_number) DO UPDATE SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  fuel_type = EXCLUDED.fuel_type,
  color = EXCLUDED.color,
  assigned_to = EXCLUDED.assigned_to,
  current_odometer = EXCLUDED.current_odometer,
  notes = EXCLUDED.notes;
