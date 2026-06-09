-- ============================================
-- FIX: Supabase Security Linter Warnings
-- Run once in the Supabase SQL Editor (production project).
--
-- Addresses:
--   1. Function Search Path Mutable     (lint 0011) — all 17+ affected functions
--   2. SECURITY DEFINER callable by anon (lint 0028) — audit_trigger_fn
--   3. SECURITY DEFINER callable by auth (lint 0029) — audit_trigger_fn
--   4. Public Bucket Allows Listing     (lint 0025) — certificates bucket
--
-- NOT changed (intentional design):
--   • RLS "Allow all" policies (lint 0024) — this app uses operator
--     selection rather than Supabase Auth. Leave as-is until full
--     auth is implemented.
-- ============================================


-- ============================================
-- 1. FIX FUNCTION SEARCH PATH (lint 0011)
--
--    Without an explicit search_path, a session-level SET search_path
--    could redirect unqualified object references to an attacker-
--    controlled schema.  Setting it to 'public, pg_catalog' locks the
--    path without requiring any changes to the function body.
--
--    This DO block discovers every overload of each affected function
--    dynamically, so old overloads that were never explicitly dropped
--    (e.g. earlier create_movement signatures) are also fixed.
-- ============================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            n.nspname                                AS schema_name,
            p.proname                                AS func_name,
            pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'create_movement',
              'get_calibration_summary',
              'get_reservation_summary',
              'create_handover',
              'get_available_report',
              'get_overdue_report',
              'get_usage_stats',
              'generate_notifications',
              'get_audit_summary',
              'get_maintenance_summary',
              'update_timestamp',
              'get_calibration_management',
              'fn_update_equipment_on_movement',
              'get_customer_stats',
              'audit_trigger_fn',
              'get_dashboard',
              'get_checked_out_report'
          )
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_catalog',
            r.schema_name, r.func_name, r.args
        );
        RAISE NOTICE 'Fixed search_path: %.%(%) ', r.schema_name, r.func_name, r.args;
    END LOOP;
END $$;


-- ============================================
-- 2. FIX SECURITY DEFINER ACCESSIBLE TO ANON / AUTHENTICATED
--    (lint 0028 & 0029)
--
--    audit_trigger_fn is a trigger function — it is called automatically
--    by PostgreSQL trigger machinery and must never be invoked directly
--    via the REST API (/rest/v1/rpc/audit_trigger_fn).
--    Revoking EXECUTE from anon and authenticated closes that surface
--    without affecting how triggers operate.
-- ============================================

-- Revoking from PUBLIC removes the default implicit grant that anon and
-- authenticated inherit. Without this, per-role revokes have no effect.
REVOKE EXECUTE ON FUNCTION public.audit_trigger_fn() FROM PUBLIC;


-- ============================================
-- 3. FIX PUBLIC BUCKET ALLOWS LISTING (lint 0025)
--
--    The "certificates" bucket has a broad SELECT policy that lets any
--    client enumerate every file stored in the bucket.  For a PUBLIC
--    bucket, files are already accessible by their direct URL — no
--    SELECT policy is required for that.  Dropping the policy prevents
--    directory listing while leaving all existing certificate URLs
--    fully functional.
--
--    If the app ever needs to call
--      supabase.storage.from('certificates').list()
--    re-add a narrower policy restricted to authenticated users only.
-- ============================================

DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
