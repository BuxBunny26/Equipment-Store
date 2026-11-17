-- ============================================
-- personnel.supervisor_id — PROPOSAL ONLY, DO NOT APPLY YET
-- ============================================
-- Migration and backfill are deliberately kept as SEPARATE operations:
--   1. this file: add the nullable column (no data changes)
--   2. verify schema (read-only)
--   3. a separate backfill script/SQL, populating ONLY the approved
--      mappings below — unresolved relationships stay NULL, never guessed.
--
-- ON DELETE SET NULL chosen over default NO ACTION: this app's convention
-- is to deactivate personnel, not hard-delete them, but SET NULL degrades
-- gracefully if a supervisor row is ever genuinely deleted — the
-- subordinate's supervisor_id just clears rather than blocking the delete
-- or leaving a dangling reference. Accepted by the user 2026-08-14.
--
-- The existing free-text personnel.supervisor column is NOT dropped —
-- retained during the transition period.

ALTER TABLE personnel
ADD COLUMN IF NOT EXISTS supervisor_id INTEGER
REFERENCES personnel(id)
ON DELETE SET NULL;

-- ============================================
-- Approved backfill (separate step — NOT executed by this file)
-- ============================================
-- Only these mappings are confirmed as of 2026-08-14. Everything else
-- (Francois Pretorius, Lea Bodenstein WC316) stays supervisor_id = NULL.
--
-- UPDATE personnel SET supervisor_id = 91  WHERE id IN (/* Adriaan du Plooy's Mozambique reports — 0 rows: none of the 5 CSV reports currently have a personnel record */);
-- UPDATE personnel SET supervisor_id = 29  WHERE id IN (14, 39, 40, 69);   -- Edward Snr Pieterse's reports
-- UPDATE personnel SET supervisor_id = 26  WHERE id IN (25, 72);           -- Eddie Jnr Pieterse's reports (excludes Lea Bodenstein — no personnel row)
-- UPDATE personnel SET supervisor_id = 94  WHERE id IN (141, 42, 57, 80, 136, 98); -- Roger Henwood canonical tie-break
