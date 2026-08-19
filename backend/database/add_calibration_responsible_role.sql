-- ============================================
-- Add 'calibration_responsible' recipient_role
-- ============================================
-- NOT APPLIED — proposal only, per 2026-08-19 review. Do not run until
-- explicitly approved.
--
-- Why needed: calibration_reminder_log.recipient_role currently only
-- allows ('holder', 'supervisor'). Unassigned/in-storage equipment
-- (current_holder_id IS NULL) is now notified via a designated
-- calibration-responsible fallback group (Andrew/Megan/Nadhira, configured
-- by personnel id — see CALIBRATION_FALLBACK_PERSONNEL_IDS in
-- backend/.env and calibration_reminder_logic.resolveFallbackRecipients).
-- Logging those sends as 'holder' or 'supervisor' would misrepresent why
-- they received the reminder, so a third role value is required before
-- --send/CALIBRATION_REMINDERS_ENABLED can ever be turned on for
-- unassigned equipment.
--
-- Additive/widening only: existing 'holder'/'supervisor' rows and the
-- partial unique claim index (idx_calibration_reminder_log_claim_unique)
-- are untouched — that index's column list already includes
-- recipient_role generically, so it automatically also covers
-- 'calibration_responsible' claims once this constraint permits the value.
--
-- Constraint name assumed to be Postgres's default naming for an inline
-- CHECK ("<table>_<column>_check") since this is the first/only CHECK on
-- this column — confirm the actual name in the Supabase SQL Editor (e.g.
-- via the table's "Constraints" tab) before running if it differs.

ALTER TABLE calibration_reminder_log
    DROP CONSTRAINT IF EXISTS calibration_reminder_log_recipient_role_check;

ALTER TABLE calibration_reminder_log
    ADD CONSTRAINT calibration_reminder_log_recipient_role_check
    CHECK (recipient_role IN ('holder', 'supervisor', 'calibration_responsible'));
