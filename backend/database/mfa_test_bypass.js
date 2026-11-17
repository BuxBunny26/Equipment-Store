/**
 * Test-account MFA bypass — allowlist parsing only. Pure functions, no
 * Supabase/network/env access here (the env var itself is read by the
 * caller, e.g. mfa-send.js, and passed in) so this stays fully unit-
 * testable without mocking anything.
 *
 * ------------------------------------------------------------------
 * SECURITY MODEL — read before touching this file or mfa-send.js
 * ------------------------------------------------------------------
 * This module NEVER weakens verification. mfa-verify.js is completely
 * unmodified by this feature and has no knowledge it exists — it always
 * checks a real, single-use, hashed, expiring OTP against the mfa_tokens
 * table exactly as it would for any real employee. The ONLY thing gated
 * by this allowlist is DELIVERY of that same OTP in mfa-send.js: for an
 * allowlisted personnel_id, the OTP is returned directly in the API
 * response instead of being emailed via Resend, so a tester can complete
 * the exact same second-factor step without checking an inbox. A real
 * employee's personnel_id is never in this list, so their flow (including
 * the Resend email) is byte-for-byte unchanged.
 *
 * FAIL-CLOSED PARSING: TEST_ACCOUNT_MFA_BYPASS_PERSONNEL_IDS must be a
 * non-empty, strictly comma-separated list of positive integers, or the
 * WHOLE list is rejected (returns null) — unlike
 * calibration_reminder_logic.js's parseFallbackPersonnelIds (which drops
 * only the bad entries), there is no "drop the bad ones, keep the good
 * ones" fallback here. A single malformed entry, a missing env var, or a
 * blank env var all mean ZERO accounts bypass. This is deliberate: an
 * allowlist controlling an authentication-adjacent behaviour must fail
 * closed on any ambiguity, not fail open for the entries that happen to
 * look valid.
 */
function parseTestBypassPersonnelIds(envValue) {
    if (envValue == null || String(envValue).trim() === '') return null;
    const parts = String(envValue).split(',').map((s) => s.trim());
    if (parts.some((p) => !/^\d+$/.test(p))) return null;
    const ids = parts.map(Number);
    if (ids.some((n) => !Number.isInteger(n) || n <= 0)) return null;
    // De-dupe defensively; order doesn't matter for membership checks.
    return Array.from(new Set(ids));
}

/**
 * True only if personnelId is a well-formed positive integer AND appears
 * verbatim in a validly-parsed allowlist. Never caches the parsed list —
 * callers pass the raw env value each invocation, so a config change (or
 * removal) takes effect on the very next request with no stale in-memory
 * state to worry about.
 *
 * Only `number` or `string` inputs are ever coerced (a normal JSON request
 * body's personnel_id is always one of these two) — objects/arrays are
 * rejected outright rather than relying on JS's looser `Number()` coercion
 * rules (e.g. `Number([501])` happens to equal `501`, which is harmless in
 * itself, but there is no reason to accept a shape a real request would
 * never send). This can never widen the bypass to a *different* personnel
 * id: it only ever matches the exact allowlisted integer value.
 */
function isTestBypassPersonnel(personnelId, envValue) {
    const ids = parseTestBypassPersonnelIds(envValue);
    if (!ids) return false;
    if (typeof personnelId !== 'number' && typeof personnelId !== 'string') return false;
    const n = Number(personnelId);
    if (!Number.isInteger(n) || n <= 0) return false;
    return ids.includes(n);
}

/**
 * Second, independent fail-closed gate: the bypass also requires this env
 * var to be the exact string 'true'. Kept as a SEPARATE flag from the
 * personnel allowlist (rather than "allowlist non-empty => enabled") so a
 * site can have the allowlist configured (e.g. copied into a shared env
 * group) without the bypass silently being live — both must be explicitly
 * set. Netlify's own per-deploy-context env var scoping (Production vs.
 * Branch deploys/Deploy Previews) is the intended way to keep this unset
 * on a production site even if it shares a codebase with staging — see
 * mfa-send.js for why a runtime `CONTEXT` check does NOT work here.
 */
function isBypassFeatureEnabled(envValue) {
    return envValue === 'true';
}

module.exports = { parseTestBypassPersonnelIds, isTestBypassPersonnel, isBypassFeatureEnabled };
