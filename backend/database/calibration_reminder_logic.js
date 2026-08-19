/**
 * Calibration reminder logic — pure, testable functions.
 *
 * No Supabase/network calls live here on purpose, so behaviour can be unit
 * tested (see test_calibration_reminders.js) without touching production
 * data or sending real emails.
 *
 * Catch-up rule (approved 2026-08-14): do NOT send every missed threshold.
 * Send only the single most urgent threshold that currently applies:
 *   16-30 days remaining -> 30
 *    8-15 days remaining -> 15
 *    4-7  days remaining -> 7
 *    0-3  days remaining -> 3
 * A threshold that was already SUCCESSFULLY sent for this equipment+expiry+
 * recipient+role is never resent. A threshold whose only prior attempt
 * FAILED is retried (the log's idempotency key only covers status='sent').
 */

const THRESHOLDS = [30, 15, 7, 3];

/** Days between two ISO date strings (b - a), truncated to whole days. */
function daysBetween(fromIso, toIso) {
    const from = new Date(fromIso + 'T00:00:00Z');
    const to = new Date(toIso + 'T00:00:00Z');
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * The single threshold band that currently applies, or null if the item is
 * more than 30 days out (too early) or already expired (not this job's
 * concern — handled by existing calibration_status logic).
 */
function currentThresholdBand(daysUntilExpiry) {
    if (daysUntilExpiry < 0 || daysUntilExpiry > 30) return null;
    if (daysUntilExpiry >= 16) return 30;
    if (daysUntilExpiry >= 8) return 15;
    if (daysUntilExpiry >= 4) return 7;
    return 3; // 0-3
}

/**
 * Given "today", an expiry date, and the set of thresholds already
 * successfully sent (status='sent' only) for this specific
 * equipment+expiry+recipient+role, return the threshold to attempt this run
 * — or null if nothing is due (either too early, already expired, or the
 * current band was already sent successfully).
 */
function dueThreshold(todayIso, expiryIso, sentThresholdsForRecipient) {
    const daysUntilExpiry = daysBetween(todayIso, expiryIso);
    const band = currentThresholdBand(daysUntilExpiry);
    if (band === null) return null;
    if (sentThresholdsForRecipient.has(band)) return null; // already delivered — do not resend
    return band;
}

/**
 * Build a lookup key for one (equipment, expiry, threshold, recipient,
 * role) combination — used to index/query the successful-send log.
 */
function reminderKey(equipmentId, expiryDate, thresholdDays, recipientPersonnelId, recipientRole) {
    return `${equipmentId}|${expiryDate}|${thresholdDays}|${recipientPersonnelId}|${recipientRole}`;
}

/**
 * Batching helper: index a flat list of successful (status='sent') log rows
 * into a Set of keys, fetched ONCE per run instead of once per
 * equipment/recipient combination (the N+1 pattern this replaces). Callers
 * should fetch `SELECT equipment_id, expiry_date, threshold_days,
 * recipient_personnel_id, recipient_role FROM calibration_reminder_log
 * WHERE status = 'sent'` a single time and pass the rows here.
 */
function indexSentRows(sentRows) {
    const set = new Set();
    for (const row of sentRows || []) {
        set.add(reminderKey(row.equipment_id, row.expiry_date, row.threshold_days, row.recipient_personnel_id, row.recipient_role));
    }
    return set;
}

/** Threshold-days already successfully sent for one specific recipient, read from the batched index. */
function sentThresholdsFor(sentIndex, equipmentId, expiryDate, recipientPersonnelId, recipientRole) {
    const sent = new Set();
    for (const t of THRESHOLDS) {
        if (sentIndex.has(reminderKey(equipmentId, expiryDate, t, recipientPersonnelId, recipientRole))) sent.add(t);
    }
    return sent;
}

/**
 * Resolve a free-text supervisor name (personnel.supervisor) to a personnel
 * record by exact case-insensitive full_name match. Returns null (not a
 * throw) when unresolved — the caller decides how to handle a missing
 * supervisor (currently: still notify the holder, log a warning).
 *
 * Legacy fallback only — used solely when the holder has no
 * personnel.supervisor_id set. See resolveSupervisorForHolder below for the
 * preferred FK-based resolution. Resolves fresh every call; never caches.
 */
function resolveSupervisor(supervisorName, personnelList) {
    if (!supervisorName) return null;
    const needle = supervisorName.trim().toLowerCase();
    return personnelList.find((p) => (p.full_name || '').trim().toLowerCase() === needle) || null;
}

/**
 * Resolve the holder's current supervisor, preferring the FK
 * (personnel.supervisor_id) over free-text name matching.
 *
 * Precedence:
 *   1. holder.supervisor_id set and resolves to a personnel record ->
 *      use it directly, no name matching involved (viaFallback: false).
 *   2. holder.supervisor_id is NULL (not yet backfilled, or genuinely
 *      unresolved e.g. Francois Pretorius / Lea Bodenstein) -> fall back
 *      to legacy free-text matching on personnel.supervisor
 *      (viaFallback: true when this actually resolves someone).
 *   3. Neither resolves -> no supervisor (holder notification is never
 *      blocked by this — see resolveRecipients).
 *
 * This fallback is transitional: once supervisor_id backfill is complete
 * for all resolvable identities, remove this function's second branch and
 * rely on the FK alone.
 */
function resolveSupervisorForHolder(holder, personnelList) {
    if (!holder) return { supervisor: null, viaFallback: false };

    if (holder.supervisor_id != null) {
        const supervisor = personnelList.find((p) => p.id === holder.supervisor_id) || null;
        return { supervisor, viaFallback: false };
    }

    const supervisor = resolveSupervisor(holder.supervisor, personnelList);
    return { supervisor, viaFallback: !!supervisor };
}

/**
 * Build the recipient list for one equipment/expiry combination.
 * Always resolves supervisor from the HOLDER's *current* personnel record
 * (not a stale value cached on an old checkout transaction) — per
 * requirement: Equipment -> Current Holder -> Current Employee -> Current Supervisor.
 * Resolved fresh on every call — a holder or supervisor change between
 * threshold runs is picked up automatically, never a stale cached value.
 *
 * An unresolved supervisor (whether via FK or fallback) NEVER prevents the
 * holder from being notified — the holder recipient is always added first,
 * independent of supervisor resolution.
 */
function resolveRecipients(holder, personnelList) {
    if (!holder) return { recipients: [], unresolvedSupervisor: false, supervisorViaFallback: false };
    const recipients = [{ personnel_id: holder.id, role: 'holder', email: holder.email }];
    const { supervisor, viaFallback } = resolveSupervisorForHolder(holder, personnelList);
    if (supervisor && supervisor.email) {
        recipients.push({ personnel_id: supervisor.id, role: 'supervisor', email: supervisor.email });
    }
    const hadSupervisorReference = holder.supervisor_id != null || !!holder.supervisor;
    return { recipients, unresolvedSupervisor: hadSupervisorReference && !supervisor, supervisorViaFallback: viaFallback };
}

/**
 * Parse the CALIBRATION_FALLBACK_PERSONNEL_IDS env value ("7,72,79") into an
 * array of integer personnel ids. Never throws — malformed/blank entries are
 * simply dropped, since an empty result correctly surfaces as "all fallback
 * recipients invalid" further downstream rather than crashing the run.
 */
function parseFallbackPersonnelIds(envValue) {
    if (!envValue) return [];
    return envValue.split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => Number.isInteger(n));
}

/**
 * Resolve the designated calibration-responsible fallback group (configured
 * by stable personnel ID, never by name/email — see
 * parseFallbackPersonnelIds) for equipment with no current holder.
 *
 * Each configured id is validated independently: must exist, must be
 * active, must have an email. An invalid one is reported (never silently
 * dropped) so the caller can log/flag it, and never causes a valid
 * recipient to be skipped. Resolved recipients are de-duplicated by
 * personnel id AND by email (defensive — two configured ids should never
 * legitimately share an email, but a reminder must never be double-sent to
 * the same inbox if that ever happens).
 */
function resolveFallbackRecipients(fallbackPersonnelIds, personnelList) {
    const personnelById = new Map(personnelList.map((p) => [p.id, p]));
    const seenIds = new Set();
    const invalid = [];
    const resolved = [];

    for (const id of fallbackPersonnelIds || []) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        const p = personnelById.get(id);
        if (!p) { invalid.push({ personnel_id: id, reason: 'no matching personnel record' }); continue; }
        if (p.is_active === false) { invalid.push({ personnel_id: id, full_name: p.full_name, reason: 'personnel record is inactive' }); continue; }
        if (!p.email) { invalid.push({ personnel_id: id, full_name: p.full_name, reason: 'personnel record has no email' }); continue; }
        resolved.push({ personnel_id: p.id, role: 'calibration_responsible', email: p.email, full_name: p.full_name });
    }

    const seenEmails = new Set();
    const recipients = resolved.filter((r) => {
        const key = r.email.toLowerCase();
        if (seenEmails.has(key)) return false;
        seenEmails.add(key);
        return true;
    });

    return { recipients, invalid };
}

/**
 * Batched candidate builder: given all due calibration records (each with
 * its equipment + current holder already resolved) and the full personnel
 * list, compute every reminder that is actually due THIS run — using a
 * single pre-fetched sent-log index rather than a query per recipient.
 * Pure/testable — no Supabase calls.
 *
 * Each returned item has a `type`:
 *   'reminder'        — an actual due reminder (holder/supervisor OR the
 *                        calibration-responsible fallback group for
 *                        unassigned equipment).
 *   'fallback_invalid' — one or more configured fallback recipients could
 *                        not be resolved for an in-band unassigned item;
 *                        informational, never blocks the valid recipients.
 *   'anomaly'         — an in-band unassigned item where NO configured
 *                        fallback recipient could be resolved at all; must
 *                        be surfaced, never silently dropped.
 */
function computeDueReminders(todayIso, calibrationRecords, personnelList, sentRows, fallbackPersonnelIds = []) {
    const personnelById = new Map(personnelList.map((p) => [p.id, p]));
    const sentIndex = indexSentRows(sentRows);
    const due = [];

    for (const cal of calibrationRecords) {
        const equipment = cal.equipment;
        if (!equipment) continue;

        if (!equipment.current_holder_id) {
            // Unassigned/in-storage equipment: notify the designated
            // calibration-responsible fallback group instead of a
            // holder+supervisor pair that doesn't exist. Never invents a
            // holder/supervisor for this case.
            const band = currentThresholdBand(daysBetween(todayIso, cal.expiry_date));
            if (band === null) continue; // not currently in a reminder band

            const { recipients: fallbackRecipients, invalid } = resolveFallbackRecipients(fallbackPersonnelIds, personnelList);

            if (invalid.length > 0) {
                due.push({ type: 'fallback_invalid', equipment, expiry_date: cal.expiry_date, threshold: band, invalid });
            }
            if (fallbackRecipients.length === 0) {
                due.push({
                    type: 'anomaly', equipment, expiry_date: cal.expiry_date, threshold: band, invalid,
                    reason: 'Unassigned equipment is due for a calibration reminder but no valid calibration-responsible fallback recipient could be resolved.',
                });
                continue;
            }

            for (const r of fallbackRecipients) {
                const sentThresholds = sentThresholdsFor(sentIndex, equipment.id, cal.expiry_date, r.personnel_id, r.role);
                const threshold = dueThreshold(todayIso, cal.expiry_date, sentThresholds);
                if (threshold === null) continue;
                due.push({ type: 'reminder', equipment, expiry_date: cal.expiry_date, threshold, recipient: r, unassigned: true, unresolvedSupervisor: false, supervisorViaFallback: false });
            }
            continue;
        }

        const holder = personnelById.get(equipment.current_holder_id);
        if (!holder) continue;

        const { recipients, unresolvedSupervisor, supervisorViaFallback } = resolveRecipients(holder, personnelList);
        for (const r of recipients) {
            if (!r.email) continue;
            const sentThresholds = sentThresholdsFor(sentIndex, equipment.id, cal.expiry_date, r.personnel_id, r.role);
            const threshold = dueThreshold(todayIso, cal.expiry_date, sentThresholds);
            if (threshold === null) continue;
            due.push({ type: 'reminder', equipment, expiry_date: cal.expiry_date, threshold, recipient: r, unassigned: false, unresolvedSupervisor, supervisorViaFallback });
        }
    }
    return due;
}

module.exports = {
    THRESHOLDS, daysBetween, currentThresholdBand, dueThreshold, resolveSupervisor, resolveSupervisorForHolder, resolveRecipients,
    reminderKey, indexSentRows, sentThresholdsFor, computeDueReminders,
    parseFallbackPersonnelIds, resolveFallbackRecipients,
};
