-- ============================================================
-- TEST ACCOUNTS — PROPOSAL ONLY. STAGING SUPABASE ONLY.
-- DO NOT RUN AGAINST PRODUCTION. DO NOT RUN WITHOUT EXPLICIT APPROVAL.
-- ============================================================
-- Creates FOUR dedicated, obviously-named test identities used ONLY to
-- manually exercise the AFS permission/RLS design as different user
-- types, on a STAGING Supabase project, without reusing, modifying, or
-- impersonating any real employee record and without ever touching
-- production:
--   - AFS Test Employee  (division AFS, role "user"    — expected restricted)
--   - AFS Test Manager   (division AFS, role "manager" — expected full rights)
--   - ARC Test Employee  (division ARC, role "user"    — negative control:
--     proves AFS restrictions do NOT leak onto ordinary ARC users)
--   - ARC Test Manager   (division ARC, role "manager" — negative control:
--     proves manager rights are role-based, not AFS-specific)
--
-- These records carry NO special-cased authorization anywhere in the app.
-- Restriction/rights come purely from role_id + personnel.division, exactly
-- the same rule that already applies to Johan Stols/Jaco Venter/Roger
-- Henwood (see frontend/src/utils/permissions.js isRestrictedAfsEmployee).
-- Nothing in this file or anywhere else says "if test account, grant X".
--
-- personnel.email uses the RFC 2606 reserved ".invalid" TLD, which can
-- never resolve to a real mailbox — safe here because the two AFS test ids
-- are meant to be added to TEST_ACCOUNT_MFA_BYPASS_PERSONNEL_IDS (a
-- STAGING/local-only Netlify env var, never set in production — see
-- mfa_test_bypass.js / mfa-send.js). The two ARC test accounts are pure UI/
-- permission negative controls and do not need the MFA bypass at all,
-- since they are never expected to be restricted in the first place.
--
-- Re-runnable but deliberately does NOT auto-update on conflict (ON
-- CONFLICT ... DO NOTHING) — if something needs to change later, edit and
-- run a separate, explicit UPDATE so the change is traceable.
--
-- PREREQUISITE: run staging_bootstrap_PROPOSAL.sql first — this file's
-- equipment INSERT depends on the synthetic 'TEST Equipment' category /
-- 'TEST General' subcategory it creates.
-- ============================================================

BEGIN;

INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, department, division, is_active)
VALUES
    ('TEST-AFS-EMP-9001', 'AFS', 'Test Employee', 'AFS Test Employee',
     'afs-test-employee@equipmentstore.invalid',
     'TEST ACCOUNT - DO NOT USE FOR REAL WORK', 'TEST', 'AFS', true),
    ('TEST-AFS-MGR-9002', 'AFS', 'Test Manager', 'AFS Test Manager',
     'afs-test-manager@equipmentstore.invalid',
     'TEST ACCOUNT - DO NOT USE FOR REAL WORK', 'TEST', 'AFS', true),
    ('TEST-ARC-EMP-9003', 'ARC', 'Test Employee', 'ARC Test Employee',
     'arc-test-employee@equipmentstore.invalid',
     'TEST ACCOUNT - DO NOT USE FOR REAL WORK', 'TEST', 'ARC', true),
    ('TEST-ARC-MGR-9004', 'ARC', 'Test Manager', 'ARC Test Manager',
     'arc-test-manager@equipmentstore.invalid',
     'TEST ACCOUNT - DO NOT USE FOR REAL WORK', 'TEST', 'ARC', true)
ON CONFLICT (employee_id) DO NOTHING;

-- role_id 3 = 'user' (ordinary employee), role_id 2 = 'manager' — per the
-- roles seed in supabase_setup.sql. personnel_id is resolved by
-- employee_id so this works regardless of the actual generated
-- personnel.id values.
INSERT INTO users (username, email, full_name, role_id, personnel_id, is_active)
SELECT 'TEST-AFS-EMP-9001', p.email, p.full_name, 3, p.id, true
FROM personnel p WHERE p.employee_id = 'TEST-AFS-EMP-9001'
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, email, full_name, role_id, personnel_id, is_active)
SELECT 'TEST-AFS-MGR-9002', p.email, p.full_name, 2, p.id, true
FROM personnel p WHERE p.employee_id = 'TEST-AFS-MGR-9002'
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, email, full_name, role_id, personnel_id, is_active)
SELECT 'TEST-ARC-EMP-9003', p.email, p.full_name, 3, p.id, true
FROM personnel p WHERE p.employee_id = 'TEST-ARC-EMP-9003'
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, email, full_name, role_id, personnel_id, is_active)
SELECT 'TEST-ARC-MGR-9004', p.email, p.full_name, 2, p.id, true
FROM personnel p WHERE p.employee_id = 'TEST-ARC-MGR-9004'
ON CONFLICT (username) DO NOTHING;

-- Three dedicated test-only equipment items — NOT real assets. Left
-- unallocated here on purpose: holder assignment should be done
-- afterwards through the real app UI (log in as "AFS Test Manager" ->
-- Check Out) so it exercises the actual create_movement RPC +
-- fn_update_equipment_on_movement trigger + audit trail, rather than a
-- raw UPDATE of current_holder_id.
--   TEST-EQ-9001 -> allocate to "AFS Test Employee"      (the one item they SHOULD see)
--   TEST-EQ-9002 -> allocate to "AFS Test Manager" instead (proves AFS Test Employee canNOT see someone else's item)
--   TEST-EQ-9003 -> leave unallocated / no holder          (proves AFS Test Employee canNOT see unassigned inventory either)
--
-- category_id/subcategory_id are set to the synthetic 'TEST Equipment' /
-- 'TEST General' pair created by staging_bootstrap_PROPOSAL.sql (run that
-- file FIRST). Both columns are technically nullable on `equipment`, but
-- get_available_report()/get_checked_out_report() (supabase_migration.sql)
-- INNER JOIN categories/subcategories, so a NULL category would silently
-- exclude these test items from those two report RPCs — assigning the
-- synthetic category keeps every code path exercisable.
INSERT INTO equipment (equipment_id, equipment_name, description, category_id, subcategory_id, is_serialised, status, notes)
SELECT v.equipment_id, v.equipment_name, v.description, c.id, sc.id, false, 'Available', v.notes
FROM (VALUES
    ('TEST-EQ-9001', 'TEST Equipment (allocate to AFS Test Employee)',
     'Dedicated test-only equipment item for AFS permission/RLS manual testing. Not a real asset.',
     'TEST DATA - allocate to AFS Test Employee via the real Check Out flow.'),
    ('TEST-EQ-9002', 'TEST Equipment (control - allocate to someone else, NOT AFS Test Employee)',
     'Negative control: proves AFS Test Employee cannot see equipment held by another person.',
     'TEST DATA - allocate to AFS Test Manager (or ARC Test Employee) via the real Check Out flow.'),
    ('TEST-EQ-9003', 'TEST Equipment (control - leave unassigned)',
     'Negative control: proves AFS Test Employee cannot see unassigned/in-storage inventory either.',
     'TEST DATA - leave unallocated, do not check out.')
) AS v(equipment_id, equipment_name, description, notes)
CROSS JOIN (SELECT id FROM categories WHERE name = 'TEST Equipment') c
CROSS JOIN (SELECT id FROM subcategories WHERE name = 'TEST General') sc
ON CONFLICT (equipment_id) DO NOTHING;

-- Verify
SELECT p.id AS personnel_id, p.employee_id, p.full_name, p.division, p.is_active AS personnel_active,
       u.id AS user_id, u.username, r.name AS role_name, u.is_active AS user_active
FROM personnel p
JOIN users u ON u.personnel_id = p.id
JOIN roles r ON r.id = u.role_id
WHERE p.employee_id IN ('TEST-AFS-EMP-9001', 'TEST-AFS-MGR-9002', 'TEST-ARC-EMP-9003', 'TEST-ARC-MGR-9004')
ORDER BY p.employee_id;

SELECT equipment_id, equipment_name, status, current_holder_id
FROM equipment
WHERE equipment_id IN ('TEST-EQ-9001', 'TEST-EQ-9002', 'TEST-EQ-9003');

COMMIT;

-- After running + verifying on STAGING, and after adding the two AFS
-- personnel ids to the STAGING-only TEST_ACCOUNT_MFA_BYPASS_PERSONNEL_IDS:
--   1. Log in as "AFS Test Manager" (PIN 9002, MFA auto-bypassed).
--   2. Check Out TEST-EQ-9001 to "AFS Test Employee".
--   3. Check Out TEST-EQ-9002 to "AFS Test Manager" itself (or ARC Test Employee).
--   4. Leave TEST-EQ-9003 unallocated.
--   5. Log in as "AFS Test Employee" (PIN 9001) and confirm the Equipment
--      page shows ONLY TEST-EQ-9001, and Check Out is hidden/blocked.
--   6. Log in as "ARC Test Employee" (PIN 9003, real email MFA — not on
--      the bypass list) and confirm ALL THREE test items are visible
--      (unrestricted ARC behaviour unchanged) and Check Out still works.
