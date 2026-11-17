-- ============================================
-- Promote Jaco Venter (WC493) to Manager role
-- Run in Supabase SQL Editor
-- ============================================
-- Confirmed 2026-08-14: AFS division, currently role_id defaults to 3 (user).
-- Follows the same pattern as set_managers.sql.

INSERT INTO users (username, email, full_name, role_id, personnel_id, is_active)
SELECT
    p.employee_id AS username,
    p.email,
    p.full_name,
    2 AS role_id,
    p.id AS personnel_id,
    true AS is_active
FROM personnel p
WHERE p.employee_id = 'WC493'
ON CONFLICT (username) DO UPDATE SET role_id = 2;

-- Verify
SELECT u.username, u.full_name, u.email, r.name AS role_name, u.is_active
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE u.username = 'WC493';
