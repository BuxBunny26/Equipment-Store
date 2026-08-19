/**
 * Calibration reminder job — sends the single most urgent applicable
 * threshold (30/15/7/3 days before expiry), never a backlog of missed ones.
 *
 * Recipients:
 *  - Assigned equipment: current holder + holder's CURRENT supervisor
 *    (Equipment -> current_holder_id -> personnel -> supervisor_id/free
 *    -text, resolved fresh every run).
 *  - Unassigned/in-storage equipment (current_holder_id IS NULL): the
 *    designated calibration-responsible fallback group, configured via
 *    CALIBRATION_FALLBACK_PERSONNEL_IDS (stable personnel ids, never names
 *    or hard-coded emails — see calibration_reminder_logic.resolveFallbackRecipients).
 *
 * Idempotent via calibration_reminder_log: only a status='sent' row blocks
 * a resend for the same (equipment, expiry_date, threshold_days,
 * recipient_personnel_id, recipient_role). A 'failed' row is retried
 * automatically on the next run — see add_calibration_reminder_log.sql.
 *
 * Write boundary (2026-08-19): all reads vs. writes are centralised in
 * calibration_reminder_runner.js — see that file for the exact boundary.
 * DRY RUN (no --send) performs SELECTs only: no reap, no attempted INSERT,
 * no Resend call, no sent/failed UPDATE.
 *
 * Usage:
 *   node database/calibration_reminders.js            # dry run
 *   node database/calibration_reminders.js --send      # send real emails
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { runCalibrationReminders } = require('./calibration_reminder_runner');
const { parseFallbackPersonnelIds } = require('./calibration_reminder_logic');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('\nMissing env vars. Check backend/.env\n');
    process.exit(1);
}

const SEND = process.argv.includes('--send');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const fallbackPersonnelIds = parseFallbackPersonnelIds(process.env.CALIBRATION_FALLBACK_PERSONNEL_IDS);

async function sendReminderEmail(recipientEmail, equipment, thresholdDays, expiryDate) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#1a237e;">Calibration Reminder</h2>
        <p><strong>${equipment.equipment_name}</strong> (${equipment.equipment_id}) is due for calibration in
        <strong>${thresholdDays} day${thresholdDays === 1 ? '' : 's'}</strong> (expires ${expiryDate}).</p>
      </div>`;
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: 'WCK Equipment Store <noreply@wearcheckarc.com>',
            to: [recipientEmail],
            subject: `Calibration due in ${thresholdDays} days — ${equipment.equipment_id}`,
            html,
        }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Resend failed (${res.status}): ${body.message || 'unknown error'}`);
    return body.id || null; // Resend's message id, stored as provider_message_id
}

async function run() {
    if (fallbackPersonnelIds.length === 0) {
        console.log('\nNOTE: CALIBRATION_FALLBACK_PERSONNEL_IDS is not set — unassigned equipment will report as an anomaly (no fallback recipient configured).\n');
    }

    const result = await runCalibrationReminders({ supabase, send: SEND, sendEmail: sendReminderEmail, fallbackPersonnelIds });

    console.log('\n----------------------------------------------');
    console.log(' Calibration Reminders — WCK Equipment Store');
    console.log('----------------------------------------------');
    console.log(`  Mode: ${SEND ? 'SEND (real emails + log)' : 'DRY RUN (SELECT only — no writes, no emails)'}`);
    console.log(`  Today: ${result.today}`);
    if (result.errors.length) result.errors.forEach((e) => console.log(`  NOTE: ${e}`));

    for (const item of result.due) {
        if (item.type === 'anomaly') {
            console.log(`  ANOMALY [${item.equipment.equipment_id}] "${item.equipment.equipment_name}" expires ${item.expiry_date} — threshold ${item.threshold}d — ${item.reason}`);
            continue;
        }
        if (item.type === 'fallback_invalid') {
            item.invalid.forEach((inv) => console.log(`  WARNING [${item.equipment.equipment_id}] configured fallback personnel_id=${inv.personnel_id}${inv.full_name ? ` (${inv.full_name})` : ''} skipped: ${inv.reason}`));
            continue;
        }
        const { equipment, expiry_date, threshold, recipient, unresolvedSupervisor, supervisorViaFallback, unassigned } = item;
        console.log(`  [${equipment.equipment_id}] "${equipment.equipment_name}" expires ${expiry_date} — threshold ${threshold}d due for ${recipient.role}${unassigned ? ' (unassigned-equipment fallback)' : ''} (${recipient.email})`);
        if (unresolvedSupervisor) console.log(`      WARNING: supervisor could not be resolved to a personnel record — holder notified, supervisor was not.`);
        if (supervisorViaFallback) console.log(`      NOTE: supervisor resolved via legacy free-text name match (personnel.supervisor_id not yet set for this holder) — verify supervisor_id backfill coverage.`);
    }

    console.log(`\n${SEND ? 'Attempted' : 'Would attempt'} ${result.attempted} reminder(s).`);
    if (SEND) console.log(`Sent: ${result.sent}, Failed: ${result.failed}, Skipped (concurrent claim): ${result.skippedClaimed}, Reaped stale claims: ${result.reaped}`);
    if (!SEND) console.log('Dry run complete (zero writes, zero emails). Re-run with --send to actually email + log.\n');
}

run();
