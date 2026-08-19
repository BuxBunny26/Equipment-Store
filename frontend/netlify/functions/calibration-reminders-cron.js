/**
 * Scheduled calibration reminder job — runs once daily via Netlify
 * Scheduled Functions.
 *
 * Cron: 0 6 * * * (06:00 UTC = 08:00 Africa/Johannesburg, which has no DST,
 * so this fixed UTC offset is always correct).
 *
 * PRODUCTION SENDING IS DISABLED BY DEFAULT. This function only actually
 * calls Resend and writes to calibration_reminder_log when the
 * CALIBRATION_REMINDERS_ENABLED environment variable is exactly "true".
 * Until that variable is set (it is NOT set today), every scheduled run is
 * a safe dry-run — see calibration_reminder_runner.js for the exact,
 * explicit write boundary (SELECT-only in dry run).
 *
 * Unassigned/in-storage equipment (current_holder_id IS NULL) is notified
 * via the calibration-responsible fallback group, configured by
 * CALIBRATION_FALLBACK_PERSONNEL_IDS (Netlify env var, stable personnel
 * ids — NOT set yet, see netlify.toml).
 *
 * Reuses the same pure logic + write-boundary engine used by
 * backend/database/calibration_reminders.js and its test suites — do not
 * duplicate the threshold/idempotency/write-boundary logic here.
 */
const { createClient } = require('@supabase/supabase-js');
const { runCalibrationReminders } = require('../../../backend/database/calibration_reminder_runner');
const { parseFallbackPersonnelIds } = require('../../../backend/database/calibration_reminder_logic');

const SEND_ENABLED = process.env.CALIBRATION_REMINDERS_ENABLED === 'true';

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
    return body.id || null;
}

exports.handler = async () => {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const fallbackPersonnelIds = parseFallbackPersonnelIds(process.env.CALIBRATION_FALLBACK_PERSONNEL_IDS);

    const result = await runCalibrationReminders({ supabase, send: SEND_ENABLED, sendEmail: sendReminderEmail, fallbackPersonnelIds });

    const log = result.due.map((item) => {
        if (item.type !== 'reminder') return { type: item.type, equipment_id: item.equipment.equipment_id, expiry_date: item.expiry_date, reason: item.reason, invalid: item.invalid };
        const { equipment, expiry_date, threshold, recipient: r, unresolvedSupervisor, supervisorViaFallback, unassigned } = item;
        return { equipment_id: equipment.equipment_id, expiry_date, threshold, role: r.role, email: r.email, would_send: !SEND_ENABLED, unresolvedSupervisor, supervisorViaFallback, unassigned };
    });

    return {
        statusCode: 200,
        body: JSON.stringify({ mode: result.mode, attempted: result.attempted, sent: result.sent, failed: result.failed, skippedClaimed: result.skippedClaimed, reaped: result.reaped, errors: result.errors, log }),
    };
};
