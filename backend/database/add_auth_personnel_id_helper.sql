-- ============================================
-- auth_personnel_id() -- verified-JWT actor identity bridge
-- ============================================
-- Scope: this is a single, narrow, reusable helper -- NOT part of the
-- broader AFS RLS rollout proposed in rls_afs_design_PROPOSAL.sql (which
-- remains entirely unapplied). It only reads whatever PostgREST has
-- already cryptographically verified for the current request; it does not
-- create or change any RLS policy, and does not grant column/table access
-- by itself.
--
-- Where the value comes from: mfa-verify.js signs a JWT containing ONLY a
-- stable identity pointer (`personnel_id`), the standard `role` claim, and
-- an `iss` claim identifying this app as the issuer -- never a mutable app
-- role or division (those must always be resolved live from
-- users/roles/personnel, never trusted from a token that could outlive a
-- permission change made mid-session). Once the frontend attaches that
-- token (supabaseClient.js's `accessToken` callback, already wired),
-- PostgREST verifies its signature against the configured JWT
-- secret/signing key before ever executing a query, and exposes the
-- verified claims to Postgres as the `request.jwt.claims` per-request GUC.
-- A forged or tampered token is rejected by PostgREST itself (HTTP 401,
-- PGRST301) and never reaches this function at all -- confirmed locally
-- via a diagnostic probe: a token signed with the wrong secret, and a
-- valid token with a hand-edited payload (old signature reused), were both
-- rejected before reaching Postgres.
--
-- Fails closed: if there is no JWT (raw anon-key request), no `iss` claim,
-- an `iss` that doesn't match this app's mfa-verify.js issuer, no
-- `personnel_id` claim, or the claim isn't a valid integer, this returns
-- NULL rather than raising -- callers (e.g. soft_delete_calibration_record)
-- must explicitly treat NULL as "no authenticated identity" and reject.
--
-- The `iss` check rejects any token not minted by this app's mfa-verify.js,
-- even one otherwise validly signed by a key PostgREST trusts for some
-- unrelated purpose -- defense in depth, since personnel_id has no meaning
-- outside this token's own issuer.
CREATE OR REPLACE FUNCTION auth_personnel_id()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_claims TEXT;
    v_raw TEXT;
BEGIN
    v_claims := current_setting('request.jwt.claims', true);
    IF v_claims IS NULL OR btrim(v_claims) = '' THEN
        RETURN NULL;
    END IF;

    IF (v_claims::json ->> 'iss') IS DISTINCT FROM 'equipment-store-mfa-verify' THEN
        RETURN NULL;
    END IF;

    v_raw := v_claims::json ->> 'personnel_id';
    IF v_raw IS NULL OR btrim(v_raw) = '' THEN
        RETURN NULL;
    END IF;

    RETURN v_raw::INTEGER;
EXCEPTION WHEN OTHERS THEN
    -- Malformed claims JSON or a non-integer personnel_id both collapse to
    -- "no identity" rather than a 500 error leaking internals.
    RETURN NULL;
END;
$$;

-- Any client (anon or authenticated Postgres role) may call this -- it only
-- ever returns what PostgREST already verified for THEIR OWN request, never
-- another caller's identity, so there is nothing to protect by restricting
-- EXECUTE. PUBLIC is still explicitly revoked first (Postgres grants EXECUTE
-- to PUBLIC by default on every newly created function) so this function's
-- privilege state is explicit and consistent with soft_delete_calibration_record's,
-- rather than relying on the implicit default.
REVOKE ALL ON FUNCTION auth_personnel_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_personnel_id() TO anon, authenticated;

-- ============================================
-- ROLLBACK (re-run to undo this migration)
-- ============================================
--   DROP FUNCTION IF EXISTS auth_personnel_id();
--
-- Note: do not drop this while soft_delete_calibration_record (or any other
-- function) still depends on it -- Postgres will refuse with a dependency
-- error, which is the correct fail-safe behaviour.
