-- ============================================
-- Calibration reminder idempotency log
-- ============================================
-- NOT YET APPLIED — revised 2026-08-14 per review. Additive only: new
-- table, no changes to existing tables.
--
-- Distinguishes ATTEMPTED from SENT: a row is created the moment a send is
-- attempted, then updated to 'sent' (with sent_at + provider_message_id) or
-- 'failed' (with error_message). A failed attempt does NOT satisfy the
-- idempotency check, so the next daily run retries it automatically.
--
-- Old calibration cycles remain as legitimate audit history: the unique key
-- includes expiry_date, so when calibration is redone and expiry_date
-- changes, prior rows for the superseded expiry are simply left alone (not
-- deleted, not repointed) — they're a true historical record of what was
-- sent for that cycle.
--
-- equipment_id FK uses default NO ACTION (not ON DELETE CASCADE): this app
-- soft-deletes equipment (equipment.deleted_at/deleted_by, see
-- add_equipment_soft_delete.sql and equipmentApi.softDelete()/restore() in
-- frontend/src/services/api.js) — equipment rows are never physically
-- DELETEd in normal operation, so CASCADE's "delete reminder history when
-- the equipment is deleted" behaviour would only ever fire on an abnormal
-- hard-delete, and would silently destroy legitimate audit history when it
-- did. NO ACTION means a hard-delete attempt is blocked instead, which is
-- the safer failure mode for something meant to be audit history.

CREATE TABLE IF NOT EXISTS calibration_reminder_log (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    expiry_date DATE NOT NULL,
    threshold_days INTEGER NOT NULL CHECK (threshold_days IN (30, 15, 7, 3)),
    recipient_personnel_id INTEGER NOT NULL REFERENCES personnel(id),
    recipient_role VARCHAR(20) NOT NULL CHECK (recipient_role IN ('holder', 'supervisor')),
    status VARCHAR(20) NOT NULL DEFAULT 'attempted'
        CHECK (status IN ('attempted', 'sent', 'failed')),
    error_message TEXT,
    provider_message_id VARCHAR(255),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calibration_reminder_log_equipment
    ON calibration_reminder_log(equipment_id, expiry_date);

-- Idempotency + concurrency claim: a partial unique index (not a
-- table-wide UNIQUE) is required — a plain UNIQUE would also block a retry
-- after a 'failed' row, which is exactly the bug being avoided.
--
-- CONCURRENCY ANALYSIS (2026-08-14): a `WHERE status = 'sent'` index ALONE
-- does not prevent double-sending if two runs overlap (e.g. a manual
-- `--send` run overlapping the Netlify scheduled invocation). Both workers
-- could see "no sent row yet", both INSERT an 'attempted' row (the 'sent'
-- only index doesn't stop that), both call the email provider, and only
-- the second 'sent' UPDATE would collide — by which point two emails have
-- already gone out. The fix used here: the index covers BOTH 'attempted'
-- and 'sent', so the INSERT of the 'attempted' row itself is the atomic
-- claim — Postgres rejects the second concurrent INSERT with a unique
-- violation, and only one worker ever proceeds to call the provider. A row
-- that ends up 'failed' naturally falls outside this index (not attempted
-- or sent), so a legitimate retry on a later run is never blocked.
CREATE UNIQUE INDEX IF NOT EXISTS idx_calibration_reminder_log_claim_unique
    ON calibration_reminder_log (
        equipment_id,
        expiry_date,
        threshold_days,
        recipient_personnel_id,
        recipient_role
    )
    WHERE status IN ('attempted', 'sent');

