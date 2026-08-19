/**
 * Integration-style tests for calibration_reminder_runner.js's write
 * boundary — uses an in-memory fake Supabase client (tailored to the exact
 * .from()/.select()/.insert()/.update()/.eq()/.lt()/.gte()/.not()/.single()
 * calls the runner actually makes) so writes/reads can be counted and
 * asserted without touching a real database.
 *
 * Usage: node database/test_calibration_runner.js
 */
const assert = require('assert');
const { runCalibrationReminders } = require('./calibration_reminder_runner');

let passed = 0;
async function test(name, fn) {
    try {
        await fn();
        console.log(`  PASS: ${name}`);
        passed++;
    } catch (err) {
        console.log(`  FAIL: ${name}`);
        console.log(`        ${err.stack || err.message}`);
        process.exitCode = 1;
    }
}

/**
 * @param {object} seed - { calibration_records, personnel, calibration_reminder_log }
 * @param {object} [opts] - { forceInsertError: (table, payload) => errorObjectOrNull }
 */
function createFakeSupabase(seed, opts = {}) {
    let idSeq = 1000;
    const tables = {
        calibration_records: seed.calibration_records || [],
        personnel: seed.personnel || [],
        calibration_reminder_log: seed.calibration_reminder_log || [],
    };
    const calls = { insert: [], update: [] };

    function builder(tableName) {
        let filtered = tables[tableName].slice();
        let mode = 'select';
        let payload = null;
        let single = false;

        const b = {
            select() { return b; },
            not(col) { filtered = filtered.filter((r) => r[col] !== null && r[col] !== undefined); return b; },
            gte(col, val) { filtered = filtered.filter((r) => r[col] >= val); return b; },
            eq(col, val) { filtered = filtered.filter((r) => r[col] === val); return b; },
            lt(col, val) { filtered = filtered.filter((r) => r[col] < val); return b; },
            insert(p) { mode = 'insert'; payload = p; calls.insert.push({ table: tableName, payload: p }); return b; },
            update(p) { mode = 'update'; payload = p; calls.update.push({ table: tableName, payload: p }); return b; },
            single() { single = true; return b; },
            then(resolve) {
                if (mode === 'insert') {
                    const forcedErr = opts.forceInsertError && opts.forceInsertError(tableName, payload);
                    if (forcedErr) { resolve({ data: null, error: forcedErr }); return; }
                    const row = Object.assign({ id: idSeq++, status: 'attempted', attempted_at: new Date().toISOString() }, payload);
                    tables[tableName].push(row);
                    resolve({ data: single ? row : [row], error: null });
                    return;
                }
                if (mode === 'update') {
                    filtered.forEach((row) => Object.assign(row, payload));
                    resolve({ data: filtered, error: null });
                    return;
                }
                resolve({ data: single ? (filtered[0] || null) : filtered, error: null });
            },
        };
        return b;
    }

    return { from: builder, _tables: tables, _calls: calls };
}

function makeSpySendEmail(behavior) {
    const spy = { calls: 0, emails: [] };
    spy.fn = async (email, equipment, threshold, expiry) => {
        spy.calls++;
        spy.emails.push(email);
        if (behavior === 'throw') throw new Error('Resend simulated failure');
        return 'msg-' + spy.calls;
    };
    return spy;
}

const PERSONNEL = [
    { id: 1, full_name: 'Holder One', email: 'holder@example.com', is_active: true },
    { id: 7, full_name: 'Andrew Robb', email: 'andrew@wearcheckrs.com', is_active: true },
];

function inBandCalRecord() {
    // Fixed 6-days-out relative to "today" computed inside the runner —
    // use a wide band via 30-day expiry from "now" so the test doesn't
    // depend on the exact date it's run.
    const expiry = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10); // ~20 days out -> 30-day band
    return [{ id: 1, equipment_id: 1, expiry_date: expiry, equipment: { id: 1, equipment_id: 'EQ-1', equipment_name: 'Widget', current_holder_id: 1 } }];
}

(async () => {
    console.log('\ncalibration_reminder_runner write-boundary tests\n');

    await test('dry run performs zero database writes (no insert, no update)', async () => {
        const supabase = createFakeSupabase({ calibration_records: inBandCalRecord(), personnel: PERSONNEL, calibration_reminder_log: [] });
        const spy = makeSpySendEmail();
        const result = await runCalibrationReminders({ supabase, send: false, sendEmail: spy.fn, fallbackPersonnelIds: [] });
        assert.ok(result.attempted >= 1, 'sanity: a due reminder should have been found');
        assert.strictEqual(supabase._calls.insert.length, 0);
        assert.strictEqual(supabase._calls.update.length, 0);
    });

    await test('dry run never calls Resend', async () => {
        const supabase = createFakeSupabase({ calibration_records: inBandCalRecord(), personnel: PERSONNEL, calibration_reminder_log: [] });
        const spy = makeSpySendEmail();
        await runCalibrationReminders({ supabase, send: false, sendEmail: spy.fn, fallbackPersonnelIds: [] });
        assert.strictEqual(spy.calls, 0);
    });

    await test('send mode reaps stale attempted claims', async () => {
        const staleAttemptedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago, well past the 10-min window
        const supabase = createFakeSupabase({
            calibration_records: [],
            personnel: PERSONNEL,
            calibration_reminder_log: [{ id: 1, equipment_id: 1, expiry_date: '2026-01-01', threshold_days: 30, recipient_personnel_id: 1, recipient_role: 'holder', status: 'attempted', attempted_at: staleAttemptedAt }],
        });
        const spy = makeSpySendEmail();
        const result = await runCalibrationReminders({ supabase, send: true, sendEmail: spy.fn, fallbackPersonnelIds: [] });
        assert.strictEqual(result.reaped, true);
        assert.strictEqual(supabase._tables.calibration_reminder_log[0].status, 'failed');
        assert.match(supabase._tables.calibration_reminder_log[0].error_message, /Reaped/);
    });

    await test('concurrent 23505 lost claim race is skipped, not sent, and does not error', async () => {
        const supabase = createFakeSupabase(
            { calibration_records: inBandCalRecord(), personnel: PERSONNEL, calibration_reminder_log: [] },
            { forceInsertError: (table) => (table === 'calibration_reminder_log' ? { code: '23505', message: 'duplicate key' } : null) }
        );
        const spy = makeSpySendEmail();
        const result = await runCalibrationReminders({ supabase, send: true, sendEmail: spy.fn, fallbackPersonnelIds: [] });
        assert.strictEqual(result.skippedClaimed, 1);
        assert.strictEqual(result.sent, 0);
        assert.strictEqual(result.failed, 0);
        assert.strictEqual(spy.calls, 0); // never emailed for a lost claim race
    });

    await test('a 23505 lost claim race does not result in a duplicate email being sent', async () => {
        // Simulate: this worker's insert always loses the race.
        const supabase = createFakeSupabase(
            { calibration_records: inBandCalRecord(), personnel: PERSONNEL, calibration_reminder_log: [] },
            { forceInsertError: () => ({ code: '23505', message: 'duplicate key' }) }
        );
        const spy = makeSpySendEmail();
        await runCalibrationReminders({ supabase, send: true, sendEmail: spy.fn, fallbackPersonnelIds: [] });
        assert.strictEqual(spy.calls, 0);
    });

    await test('failed sends remain retryable on the next run', async () => {
        const supabase = createFakeSupabase({ calibration_records: inBandCalRecord(), personnel: PERSONNEL, calibration_reminder_log: [] });
        const spy = makeSpySendEmail('throw');
        const firstRun = await runCalibrationReminders({ supabase, send: true, sendEmail: spy.fn, fallbackPersonnelIds: [] });
        assert.strictEqual(firstRun.failed, 1);
        assert.strictEqual(firstRun.sent, 0);
        // Table now has a 'failed' row, not 'sent' — a second run must still see it as due.
        const spy2 = makeSpySendEmail();
        const secondRunDry = await runCalibrationReminders({ supabase, send: false, sendEmail: spy2.fn, fallbackPersonnelIds: [] });
        assert.ok(secondRunDry.attempted >= 1, 'a failed (not sent) reminder must still be due on the next run');
    });

    await test('dry run with unassigned equipment performs ZERO writes and ZERO email sends', async () => {
        const expiry = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10); // ~10 days out -> 15-day band
        const supabase = createFakeSupabase({
            calibration_records: [{ id: 2, equipment_id: 2, expiry_date: expiry, equipment: { id: 2, equipment_id: 'EQ-2', equipment_name: 'Orphan Meter', current_holder_id: null } }],
            personnel: PERSONNEL,
            calibration_reminder_log: [],
        });
        const spy = makeSpySendEmail();
        const result = await runCalibrationReminders({ supabase, send: false, sendEmail: spy.fn, fallbackPersonnelIds: [7] });
        assert.ok(result.due.some((d) => d.type === 'reminder' && d.recipient.role === 'calibration_responsible'));
        assert.strictEqual(supabase._calls.insert.length, 0);
        assert.strictEqual(supabase._calls.update.length, 0);
        assert.strictEqual(spy.calls, 0);
    });

    console.log(`\n${passed} test(s) passed.\n`);
})();
