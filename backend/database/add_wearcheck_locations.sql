-- Add new WearCheck branch locations
-- Safe to run multiple times (skips existing entries)

INSERT INTO locations (name, description, type)
SELECT name, description, 'Branch'
FROM (VALUES
    ('WearCheck - Fochville', 'Fochville Branch'),
    ('WearCheck - Rustenburg', 'Rustenburg Branch'),
    ('WearCheck - Krugersdorp', 'Krugersdorp Branch')
) AS t(name, description)
WHERE NOT EXISTS (
    SELECT 1 FROM locations l WHERE LOWER(l.name) = LOWER(t.name)
);
