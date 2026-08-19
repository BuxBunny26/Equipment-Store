/**
 * Unit tests for calibration_reminder_logic.js.
 * Pure logic only — no Supabase calls, no network, no real emails.
 * Usage: node database/test_calibration_reminders.js
 */
const assert = require('assert');
const { daysBetween, currentThresholdBand, dueThreshold, resolveSupervisor, resolveSupervisorForHolder, resolveRecipients, reminderKey, indexSentRows, sentThresholdsFor, computeDueReminders, parseFallbackPersonnelIds, resolveFallbackRecipients } = require('./calibration_reminder_logic');

let passed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  PASS: ${name}`);
        passed++;
    } catch (err) {
        console.log(`  FAIL: ${name}`);
        console.log(`        ${err.message}`);
        process.exitCode = 1;
    }
}

console.log('\ncalibration_reminder_logic tests\n');

test('daysBetween computes whole-day difference', () => {
    assert.strictEqual(daysBetween('2026-08-14', '2026-09-13'), 30);
    assert.strictEqual(daysBetween('2026-08-14', '2026-08-14'), 0);
});

test('currentThresholdBand maps every band correctly', () => {
    assert.strictEqual(currentThresholdBand(30), 30);
    assert.strictEqual(currentThresholdBand(16), 30);
    assert.strictEqual(currentThresholdBand(15), 15);
    assert.strictEqual(currentThresholdBand(8), 15);
    assert.strictEqual(currentThresholdBand(7), 7);
    assert.strictEqual(currentThresholdBand(4), 7);
    assert.strictEqual(currentThresholdBand(3), 3);
    assert.strictEqual(currentThresholdBand(0), 3);
    assert.strictEqual(currentThresholdBand(-1), null); // expired — not this job's concern
    assert.strictEqual(currentThresholdBand(31), null); // too early
});

test('dueThreshold fires the current band when nothing sent yet', () => {
    assert.strictEqual(dueThreshold('2026-08-14', '2026-09-13', new Set()), 30); // 30 days out
});

test('dueThreshold returns null once the current band was already sent', () => {
    assert.strictEqual(dueThreshold('2026-08-14', '2026-08-21', new Set([7])), null); // 7 days out, already sent
});

// --- Required scenarios A-F (approved catch-up rule, 2026-08-14) ---

test('Scenario A: 30-day sent, 15-day run missed, next run at 14 days -> send one 15-day reminder', () => {
    const sent = new Set([30]); // only the 30-day threshold was ever successfully sent
    const result = dueThreshold('2026-08-14', '2026-08-28', sent); // 14 days out
    assert.strictEqual(result, 15);
});

test('Scenario B: no runs from 31 days to 6 days -> send only one 7-day reminder, not 30+15+7', () => {
    const sent = new Set(); // nothing ever sent
    const result = dueThreshold('2026-08-14', '2026-08-20', sent); // 6 days out
    assert.strictEqual(result, 7);
});

test('Scenario C: 7-day attempted+failed at 7 days, retried at 6 days', () => {
    // A failed attempt must NOT appear in the "sent" set (only status='sent' counts).
    const sentAfterFailure = new Set(); // the failed 7-day attempt is not in here
    const result = dueThreshold('2026-08-14', '2026-08-20', sentAfterFailure); // 6 days out
    assert.strictEqual(result, 7); // retried, not skipped
});

test('Scenario D: equipment transfers holder before 7-day threshold -> new holder notified, old holder is not', () => {
    const personnel = [
        { id: 1, full_name: 'Holder A', email: 'a@example.com' },
        { id: 2, full_name: 'Holder B', email: 'b@example.com' },
    ];
    // Holder A's 15-day send is irrelevant to Holder B's idempotency key —
    // the "sent" set passed in must be scoped per-recipient by the caller.
    const holderBSentSet = new Set(); // Holder B has no prior sends logged
    const dueForHolderB = dueThreshold('2026-08-14', '2026-08-20', holderBSentSet); // 6 days out
    assert.strictEqual(dueForHolderB, 7);
    const { recipients } = resolveRecipients(personnel[1], personnel);
    assert.strictEqual(recipients[0].personnel_id, 2); // Holder B, not Holder A
});

test('Scenario E: supervisor changes after 15-day reminder -> current supervisor resolved fresh at 7 days', () => {
    const personnel = [
        { id: 10, full_name: 'Old Supervisor', email: 'old@example.com' },
        { id: 11, full_name: 'New Supervisor', email: 'new@example.com' },
        { id: 12, full_name: 'Holder Person', email: 'holder@example.com', supervisor: 'New Supervisor' },
    ];
    const { recipients } = resolveRecipients(personnel[2], personnel);
    const supervisorRecipient = recipients.find((r) => r.role === 'supervisor');
    assert.strictEqual(supervisorRecipient.personnel_id, 11); // New Supervisor, never the old one
});

test('Scenario F: first-ever run at 2 days out -> send only the 3-day reminder, not retroactive 30/15/7', () => {
    const result = dueThreshold('2026-08-14', '2026-08-16', new Set()); // 2 days out, nothing sent before
    assert.strictEqual(result, 3);
});

test('resolveSupervisor matches case-insensitively', () => {
    const personnel = [{ id: 1, full_name: 'Jaco Venter' }];
    const found = resolveSupervisor('JACO venter', personnel);
    assert.strictEqual(found.id, 1);
});

test('resolveSupervisor returns null when unresolved', () => {
    const found = resolveSupervisor('Nobody Here', [{ id: 1, full_name: 'Jaco Venter' }]);
    assert.strictEqual(found, null);
});

test('resolveRecipients includes holder + resolved supervisor', () => {
    const personnel = [
        { id: 1, full_name: 'Jaco Venter', email: 'jaco@example.com' },
        { id: 2, full_name: 'Holder Person', email: 'holder@example.com', supervisor: 'Jaco Venter' },
    ];
    const holder = personnel[1];
    const { recipients, unresolvedSupervisor } = resolveRecipients(holder, personnel);
    assert.strictEqual(recipients.length, 2);
    assert.strictEqual(recipients[0].role, 'holder');
    assert.strictEqual(recipients[1].role, 'supervisor');
    assert.strictEqual(unresolvedSupervisor, false);
});

test('resolveRecipients flags an unresolved supervisor but still includes the holder', () => {
    const holder = { id: 2, full_name: 'Holder Person', email: 'holder@example.com', supervisor: 'Ghost Manager' };
    const { recipients, unresolvedSupervisor } = resolveRecipients(holder, [holder]);
    assert.strictEqual(recipients.length, 1);
    assert.strictEqual(unresolvedSupervisor, true);
});

test('resolveRecipients returns nothing for a null holder (no current holder)', () => {
    const { recipients } = resolveRecipients(null, []);
    assert.deepStrictEqual(recipients, []);
});

// --- supervisor_id-first resolution (2026-08-17) ---

test('resolveSupervisorForHolder prefers supervisor_id over free-text name, even when they disagree', () => {
    const personnel = [
        { id: 1, full_name: 'Correct Supervisor', email: 'correct@example.com' },
        { id: 2, full_name: 'Stale Name Match', email: 'stale@example.com' },
    ];
    const holder = { id: 3, full_name: 'Holder', supervisor_id: 1, supervisor: 'Stale Name Match' };
    const { supervisor, viaFallback } = resolveSupervisorForHolder(holder, personnel);
    assert.strictEqual(supervisor.id, 1); // FK wins, not the name match
    assert.strictEqual(viaFallback, false);
});

test('resolveSupervisorForHolder falls back to free-text name match when supervisor_id is null', () => {
    const personnel = [{ id: 1, full_name: 'Named Supervisor', email: 'named@example.com' }];
    const holder = { id: 2, full_name: 'Holder', supervisor_id: null, supervisor: 'Named Supervisor' };
    const { supervisor, viaFallback } = resolveSupervisorForHolder(holder, personnel);
    assert.strictEqual(supervisor.id, 1);
    assert.strictEqual(viaFallback, true);
});

test('resolveSupervisorForHolder returns null (not a throw) for a dangling supervisor_id', () => {
    const personnel = [{ id: 99, full_name: 'Someone Else', email: 'x@example.com' }];
    const holder = { id: 2, full_name: 'Holder', supervisor_id: 12345, supervisor: null };
    const { supervisor, viaFallback } = resolveSupervisorForHolder(holder, personnel);
    assert.strictEqual(supervisor, null);
    assert.strictEqual(viaFallback, false);
});

test('resolveRecipients: supervisor_id resolved -> supervisorViaFallback is false', () => {
    const personnel = [
        { id: 1, full_name: 'Supervisor', email: 'sup@example.com' },
        { id: 2, full_name: 'Holder', email: 'holder@example.com', supervisor_id: 1, supervisor: 'Someone Unrelated' },
    ];
    const { recipients, unresolvedSupervisor, supervisorViaFallback } = resolveRecipients(personnel[1], personnel);
    assert.strictEqual(recipients.find((r) => r.role === 'supervisor').personnel_id, 1);
    assert.strictEqual(unresolvedSupervisor, false);
    assert.strictEqual(supervisorViaFallback, false);
});

test('resolveRecipients: legacy free-text resolution -> supervisorViaFallback is true', () => {
    const personnel = [
        { id: 1, full_name: 'Jaco Venter', email: 'jaco@example.com' },
        { id: 2, full_name: 'Holder Person', email: 'holder@example.com', supervisor: 'Jaco Venter' },
    ];
    const { supervisorViaFallback } = resolveRecipients(personnel[1], personnel);
    assert.strictEqual(supervisorViaFallback, true);
});

test('resolveRecipients: dangling supervisor_id still notifies the holder and flags unresolved', () => {
    const holder = { id: 2, full_name: 'Holder Person', email: 'holder@example.com', supervisor_id: 999, supervisor: null };
    const { recipients, unresolvedSupervisor, supervisorViaFallback } = resolveRecipients(holder, [holder]);
    assert.strictEqual(recipients.length, 1); // holder only
    assert.strictEqual(unresolvedSupervisor, true);
    assert.strictEqual(supervisorViaFallback, false);
});

// --- Batching (single-query idempotency lookup, fixes the earlier N+1 pattern) ---

test('indexSentRows + sentThresholdsFor: recognises a sent row from the batched index', () => {
    const sentRows = [{ equipment_id: 5, expiry_date: '2026-09-13', threshold_days: 30, recipient_personnel_id: 2, recipient_role: 'holder' }];
    const index = indexSentRows(sentRows);
    const thresholds = sentThresholdsFor(index, 5, '2026-09-13', 2, 'holder');
    assert.deepStrictEqual([...thresholds], [30]);
});

test('sentThresholdsFor does not cross-contaminate a different recipient/role/equipment', () => {
    const sentRows = [{ equipment_id: 5, expiry_date: '2026-09-13', threshold_days: 30, recipient_personnel_id: 2, recipient_role: 'holder' }];
    const index = indexSentRows(sentRows);
    assert.strictEqual(sentThresholdsFor(index, 5, '2026-09-13', 2, 'supervisor').size, 0); // different role
    assert.strictEqual(sentThresholdsFor(index, 5, '2026-09-13', 3, 'holder').size, 0); // different recipient
    assert.strictEqual(sentThresholdsFor(index, 6, '2026-09-13', 2, 'holder').size, 0); // different equipment
});

test('computeDueReminders processes multiple equipment/recipients using ONE sent-log fetch (batched, not N+1)', () => {
    const personnel = [
        { id: 1, full_name: 'Holder One', email: 'one@example.com' },
        { id: 2, full_name: 'Holder Two', email: 'two@example.com' },
    ];
    const calRecords = [
        { expiry_date: '2026-09-13', equipment: { id: 100, equipment_id: 'EQ-100', equipment_name: 'Widget', current_holder_id: 1 } }, // 30 days out
        { expiry_date: '2026-08-20', equipment: { id: 200, equipment_id: 'EQ-200', equipment_name: 'Gadget', current_holder_id: 2 } }, // 6 days out
    ];
    const sentRows = [
        { equipment_id: 200, expiry_date: '2026-08-20', threshold_days: 7, recipient_personnel_id: 2, recipient_role: 'holder' }, // already sent — must be skipped
    ];
    const due = computeDueReminders('2026-08-14', calRecords, personnel, sentRows);
    assert.strictEqual(due.length, 1); // only EQ-100's 30-day reminder is due; EQ-200's 7-day was already sent
    assert.strictEqual(due[0].equipment.equipment_id, 'EQ-100');
    assert.strictEqual(due[0].threshold, 30);
});

test('computeDueReminders retries a FAILED attempt (not present in the sent-only index)', () => {
    const personnel = [{ id: 1, full_name: 'Holder One', email: 'one@example.com' }];
    const calRecords = [{ expiry_date: '2026-08-20', equipment: { id: 100, equipment_id: 'EQ-100', equipment_name: 'Widget', current_holder_id: 1 } }]; // 6 days out
    const due = computeDueReminders('2026-08-14', calRecords, personnel, []); // no 'sent' rows — a prior 'failed' row wouldn't appear here
    assert.strictEqual(due.length, 1);
    assert.strictEqual(due[0].threshold, 7);
});

// --- Unassigned-equipment calibration-responsible fallback group (2026-08-19) ---

const FALLBACK_PERSONNEL = [
    { id: 7, full_name: 'Andrew Robb', email: 'andrew@wearcheckrs.com', is_active: true },
    { id: 72, full_name: 'Megan Salzwedel', email: 'megan@wearcheckrs.com', is_active: true },
    { id: 79, full_name: 'Nadhira Bux', email: 'nadhira@wearcheckrs.com', is_active: true },
];

test('parseFallbackPersonnelIds parses a comma-separated env value into integer ids', () => {
    assert.deepStrictEqual(parseFallbackPersonnelIds('7,72,79'), [7, 72, 79]);
    assert.deepStrictEqual(parseFallbackPersonnelIds(' 7 , 72 ,79 '), [7, 72, 79]);
});

test('parseFallbackPersonnelIds returns an empty array for unset/blank/malformed values', () => {
    assert.deepStrictEqual(parseFallbackPersonnelIds(undefined), []);
    assert.deepStrictEqual(parseFallbackPersonnelIds(''), []);
    assert.deepStrictEqual(parseFallbackPersonnelIds('abc,,7'), [7]);
});

test('resolveFallbackRecipients resolves all three configured active personnel with emails', () => {
    const { recipients, invalid } = resolveFallbackRecipients([7, 72, 79], FALLBACK_PERSONNEL);
    assert.strictEqual(recipients.length, 3);
    assert.deepStrictEqual(recipients.map((r) => r.role), ['calibration_responsible', 'calibration_responsible', 'calibration_responsible']);
    assert.strictEqual(invalid.length, 0);
});

test('resolveFallbackRecipients skips and reports an inactive configured recipient', () => {
    const personnel = [...FALLBACK_PERSONNEL.slice(0, 2), { id: 79, full_name: 'Nadhira Bux', email: 'nadhira@wearcheckrs.com', is_active: false }];
    const { recipients, invalid } = resolveFallbackRecipients([7, 72, 79], personnel);
    assert.strictEqual(recipients.length, 2);
    assert.strictEqual(invalid.length, 1);
    assert.strictEqual(invalid[0].personnel_id, 79);
    assert.match(invalid[0].reason, /inactive/);
});

test('resolveFallbackRecipients skips and reports a configured recipient with no email', () => {
    const personnel = [...FALLBACK_PERSONNEL.slice(0, 2), { id: 79, full_name: 'Nadhira Bux', email: null, is_active: true }];
    const { recipients, invalid } = resolveFallbackRecipients([7, 72, 79], personnel);
    assert.strictEqual(recipients.length, 2);
    assert.strictEqual(invalid[0].reason, 'personnel record has no email');
});

test('resolveFallbackRecipients de-duplicates repeated configured ids', () => {
    const { recipients } = resolveFallbackRecipients([7, 7, 72], FALLBACK_PERSONNEL);
    assert.strictEqual(recipients.length, 2);
});

test('resolveFallbackRecipients reports ALL configured ids invalid when none resolve', () => {
    const { recipients, invalid } = resolveFallbackRecipients([9999], FALLBACK_PERSONNEL);
    assert.strictEqual(recipients.length, 0);
    assert.strictEqual(invalid.length, 1);
});

test('computeDueReminders: unassigned in-band equipment produces the fallback group, not a holder/supervisor', () => {
    const calRecords = [{ expiry_date: '2026-08-28', equipment: { id: 500, equipment_id: 'EQ-500', equipment_name: 'Unassigned Meter', current_holder_id: null } }]; // 14 days out -> 15 band
    const due = computeDueReminders('2026-08-14', calRecords, FALLBACK_PERSONNEL, [], [7, 72, 79]);
    const reminders = due.filter((d) => d.type === 'reminder');
    assert.strictEqual(reminders.length, 3);
    assert.deepStrictEqual(reminders.map((r) => r.recipient.role).sort(), ['calibration_responsible', 'calibration_responsible', 'calibration_responsible']);
    assert.deepStrictEqual(reminders.map((r) => r.recipient.personnel_id).sort(), [7, 72, 79]);
    reminders.forEach((r) => assert.strictEqual(r.threshold, 15));
});

test('computeDueReminders: assigned equipment does NOT additionally notify the fallback group', () => {
    const personnel = [...FALLBACK_PERSONNEL, { id: 1, full_name: 'Holder One', email: 'holder@example.com' }];
    const calRecords = [{ expiry_date: '2026-08-28', equipment: { id: 501, equipment_id: 'EQ-501', equipment_name: 'Assigned Meter', current_holder_id: 1 } }];
    const due = computeDueReminders('2026-08-14', calRecords, personnel, [], [7, 72, 79]);
    assert.strictEqual(due.length, 1); // holder only, no supervisor set, no fallback group involved
    assert.strictEqual(due[0].recipient.role, 'holder');
});

test('computeDueReminders: unassigned equipment with zero valid fallback recipients raises an anomaly, not a silent skip', () => {
    const calRecords = [{ expiry_date: '2026-08-28', equipment: { id: 502, equipment_id: 'EQ-502', equipment_name: 'Orphan Meter', current_holder_id: null } }];
    const due = computeDueReminders('2026-08-14', calRecords, [], [], []); // no fallback ids configured at all
    assert.strictEqual(due.length, 1);
    assert.strictEqual(due[0].type, 'anomaly');
});

test('computeDueReminders: unassigned equipment with a partially-invalid fallback config still notifies the valid ones and flags the invalid one', () => {
    const personnel = [FALLBACK_PERSONNEL[0], FALLBACK_PERSONNEL[1], { id: 79, full_name: 'Nadhira Bux', email: null, is_active: true }];
    const calRecords = [{ expiry_date: '2026-08-28', equipment: { id: 503, equipment_id: 'EQ-503', equipment_name: 'Partial Meter', current_holder_id: null } }];
    const due = computeDueReminders('2026-08-14', calRecords, personnel, [], [7, 72, 79]);
    const reminders = due.filter((d) => d.type === 'reminder');
    const flags = due.filter((d) => d.type === 'fallback_invalid');
    assert.strictEqual(reminders.length, 2);
    assert.strictEqual(flags.length, 1);
    assert.strictEqual(flags[0].invalid[0].personnel_id, 79);
});

test('computeDueReminders: fallback recipients participate in idempotency like any other recipient', () => {
    const calRecords = [{ expiry_date: '2026-08-28', equipment: { id: 504, equipment_id: 'EQ-504', equipment_name: 'Logged Meter', current_holder_id: null } }]; // 14 days -> 15 band
    const sentRows = [{ equipment_id: 504, expiry_date: '2026-08-28', threshold_days: 15, recipient_personnel_id: 7, recipient_role: 'calibration_responsible' }]; // Andrew already sent
    const due = computeDueReminders('2026-08-14', calRecords, FALLBACK_PERSONNEL, sentRows, [7, 72, 79]);
    const reminders = due.filter((d) => d.type === 'reminder');
    assert.strictEqual(reminders.length, 2); // Andrew suppressed, Megan + Nadhira still due
    assert.ok(!reminders.some((r) => r.recipient.personnel_id === 7));
});

test('computeDueReminders: catch-up rule unchanged for unassigned equipment (single current band only)', () => {
    const calRecords = [{ expiry_date: '2026-08-20', equipment: { id: 505, equipment_id: 'EQ-505', equipment_name: 'Catchup Meter', current_holder_id: null } }]; // 6 days out
    const sentRows = []; // nothing ever sent — a naive "send all missed" bug would fire 30+15+7
    const due = computeDueReminders('2026-08-14', calRecords, FALLBACK_PERSONNEL, sentRows, [7, 72, 79]);
    const reminders = due.filter((d) => d.type === 'reminder');
    reminders.forEach((r) => assert.strictEqual(r.threshold, 7)); // only the 7-day band, never 30/15 too
});

console.log(`\n${passed} test(s) passed.\n`);
