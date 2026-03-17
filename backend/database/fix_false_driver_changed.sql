-- Fix records where driver_changed was accidentally set to true
-- but new_driver_name is the same as driver_name (no actual driver change)
-- Run this in Supabase SQL Editor

UPDATE vehicle_checkouts
SET driver_changed = false, new_driver_name = NULL
WHERE driver_changed = true
  AND (
    new_driver_name IS NULL
    OR LOWER(TRIM(new_driver_name)) = LOWER(TRIM(driver_name))
    OR new_driver_name = ''
  );
