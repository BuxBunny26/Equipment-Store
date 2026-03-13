-- ============================================
-- Set Manager Role (role_id = 2) for specified personnel
-- Run in Supabase SQL Editor
-- ============================================

-- First, ensure user accounts exist for these personnel (create if missing)
INSERT INTO users (username, email, full_name, role_id, personnel_id, is_active)
SELECT 
    p.employee_id AS username,
    p.email,
    p.full_name,
    2 AS role_id,
    p.id AS personnel_id,
    true AS is_active
FROM personnel p
WHERE p.employee_id IN ('WEC076','WC363','WC492','WC383','WEC103','WC352','WEC102','WC591','WC381','WEC130')
ON CONFLICT (username) DO UPDATE SET role_id = 2;

-- Verify the results
SELECT u.username, u.full_name, u.email, r.name AS role_name, u.is_active
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE u.username IN ('WEC076','WC363','WC492','WC383','WEC103','WC352','WEC102','WC591','WC381','WEC130')
ORDER BY u.full_name;
