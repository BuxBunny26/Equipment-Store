/**
 * Shared calibration reminder execution engine used by both the manual CLI
 * script (calibration_reminders.js) and the Netlify scheduled function
 * (calibration-reminders-cron.js). A single implementation, instead of two
 * near-identical copies, so the write boundary below can't drift out of
 * sync between them again.
 *
 * WRITE BOUNDARY (explicit in code, not just relied on via naming):
 *   send === false (DRY RUN): only SELECTs happen. No stale-claim reap, no
 *     attempted INSERT, no Resend call, no sent/failed UPDATE.
 *   send === true (SEND MODE): reap UPDATE allowed, attempted INSERT
 *     allowed, the sendEmail callback (Resend) allowed, sent/failed UPDATE
 *     allowed.
 * Every write-capable statement in this file is guarded by `if (!send)
 * return`/`continue` immediately beforehand — see the two marked spots.
 */
const { computeDueReminders } = require('./calibration_reminder_logic');

const STALE_ATTEMPT_MINUTES = 10;

async function reapStaleClaims(supabase) {
    const staleCutoff = new Date(Date.now() - STALE_ATTEMPT_MINUTES * 60 * 1000).toISOString();
    return supabase
        .from('calibration_reminder_log')
        .update({
            status: 'failed',
            error_message: `Reaped: attempted row older than ${STALE_ATTEMPT_MINUTES} minutes (worker likely crashed before completing)`,
        })
        .eq('status', 'attempted')
        .lt('attempted_at', staleCutoff);
}

/**
 * @param {object} opts
 * @param {object} opts.supabase - a supabase-js client (or compatible fake)
 * @param {boolean} opts.send - false = dry run (SELECT only), true = send mode
 * @param {(email:string, equipment:object, threshold:number, expiryDate:string) => Promise<string|null>} opts.sendEmail
 * @param {number[]} [opts.fallbackPersonnelIds] - calibration-responsible fallback group
 */
async function runCalibrationReminders({ supabase, send, sendEmail, fallbackPersonnelIds = [] }) {
    const today = new Date().toISOString().slice(0, 10);
    const result = { mode: send ? 'send' : 'dry-run', today, due: [], attempted: 0, sent: 0, failed: 0, skippedClaimed: 0, reaped: false, errors: [] };

    const { data: calRecords, error: calErr } = await supabase
        .from('calibration_records')
        .select('id, equipment_id, expiry_date, equipment(id, equipment_id, equipment_name, current_holder_id)')
        .not('expiry_date', 'is', null)
        .gte('expiry_date', today);
    if (calErr) { result.errors.push(`calibration_records fetch failed: ${calErr.message}`); return result; }

    const { data: personnelList, error: perErr } = await supabase
        .from('personnel').select('id, full_name, email, supervisor, supervisor_id, is_active');
    if (perErr) { result.errors.push(`personnel fetch failed: ${perErr.message}`); return result; }

    // --- WRITE BOUNDARY #1: stale-claim reap is a write, send-mode only ---
    if (send) {
        const { error: reapErr } = await reapStaleClaims(supabase);
        result.reaped = !reapErr;
        if (reapErr) result.errors.push(`Stale-claim reap skipped (likely migration not applied yet): ${reapErr.message}`);
    }

    const { data: sentRows, error: logErr } = await supabase
        .from('calibration_reminder_log')
        .select('equipment_id, expiry_date, threshold_days, recipient_personnel_id, recipient_role')
        .eq('status', 'sent');
    if (logErr) result.errors.push(`calibration_reminder_log check failed (likely migration not applied yet): ${logErr.message}`);

    const due = computeDueReminders(today, calRecords || [], personnelList || [], sentRows || [], fallbackPersonnelIds);
    result.due = due;

    for (const item of due) {
        if (item.type !== 'reminder') continue; // fallback_invalid/anomaly are reported only, never acted on
        result.attempted++;

        // --- WRITE BOUNDARY #2: everything below is send-mode only ---
        if (!send) continue;

        const { equipment, expiry_date, threshold, recipient } = item;
        const { data: attemptRow, error: insertErr } = await supabase
            .from('calibration_reminder_log')
            .insert({
                equipment_id: equipment.id, expiry_date, threshold_days: threshold,
                recipient_personnel_id: recipient.personnel_id, recipient_role: recipient.role, status: 'attempted',
            })
            .select('id').single();

        // A unique-violation (Postgres 23505) means another worker already
        // claimed this exact reminder concurrently — not a real failure,
        // just this run losing the race. Either way, do not send.
        if (insertErr) {
            if (insertErr.code === '23505') result.skippedClaimed++;
            else { result.failed++; result.errors.push(`insert attempt failed: ${insertErr.message}`); }
            continue;
        }

        try {
            const providerMessageId = await sendEmail(recipient.email, equipment, threshold, expiry_date);
            await supabase.from('calibration_reminder_log').update({
                status: 'sent', sent_at: new Date().toISOString(), provider_message_id: providerMessageId,
            }).eq('id', attemptRow.id);
            result.sent++;
        } catch (sendErr) {
            await supabase.from('calibration_reminder_log').update({
                status: 'failed', error_message: sendErr.message,
            }).eq('id', attemptRow.id);
            result.failed++;
        }
    }

    return result;
}

module.exports = { runCalibrationReminders, reapStaleClaims, STALE_ATTEMPT_MINUTES };
