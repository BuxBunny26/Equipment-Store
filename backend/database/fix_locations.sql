-- Fix locations: Keep only the 3 real WearCheck branches active

-- Deactivate all locations except the 3 real branches
UPDATE locations 
SET is_active = FALSE 
WHERE name NOT IN ('ARC Head Office - Longmeadow', 'ARC Springs', 'WearCheck KZN');

-- Verify the result
SELECT name, is_active FROM locations ORDER BY is_active DESC, name;
