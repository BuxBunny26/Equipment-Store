/**
 * Regression tests for the calibration-status fix (Bug A: zero-record equipment showing
 * "Calibrated"; Bug B: a newer valid calibration not clearing a stale "Expired" status).
 * Pure logic only — no Supabase calls, no network.
 * Usage: node database/test_calibration_status_logic.js
 */
const assert = require('assert');
const { pickLatestCalibrationRecord, classifyCalibrationStatus, getCurrentCalibrationStatus, equipmentListBadgeLabel } = require('./calibration_status_logic');

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

const TODAY = '2026-08-24';

console.log('\ncalibration_status_logic tests\n');

test('A. Zero calibration records -> Not Calibrated', () => {
    assert.strictEqual(getCurrentCalibrationStatus([], TODAY), 'Not Calibrated');
});

test('B. One expired calibration record -> Expired', () => {
    const records = [{ id: 1, calibration_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z', expiry_date: '2026-01-01' }];
    assert.strictEqual(getCurrentCalibrationStatus(records, TODAY), 'Expired');
});

test('C. One valid calibration record -> Valid', () => {
    const records = [{ id: 1, calibration_date: '2026-06-01', created_at: '2026-06-01T00:00:00Z', expiry_date: '2027-06-01' }];
    assert.strictEqual(getCurrentCalibrationStatus(records, TODAY), 'Valid');
});

test('D. Older expired + newer valid record (different calibration_date) -> Valid, not Expired', () => {
    const records = [
        { id: 1, calibration_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z', expiry_date: '2026-01-01' }, // expired
        { id: 2, calibration_date: '2026-08-01', created_at: '2026-08-01T00:00:00Z', expiry_date: '2027-08-01' }, // valid, newer
    ];
    assert.strictEqual(getCurrentCalibrationStatus(records, TODAY), 'Valid');
});

test('E. Older valid + newer expired record -> Expired', () => {
    const records = [
        { id: 1, calibration_date: '2020-01-01', created_at: '2020-01-01T00:00:00Z', expiry_date: '2099-01-01' }, // far-future valid but OLDER calibration event
        { id: 2, calibration_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z', expiry_date: '2026-01-01' }, // newer calibration event, now expired
    ];
    assert.strictEqual(getCurrentCalibrationStatus(records, TODAY), 'Expired');
});

test('F. Live regression repro (equipment EQ-B2140140918): tied calibration_date, newer record added later must win over an old Expired record', () => {
    // Reproduces the exact production data found for equipment id 56 / serial B2140140918:
    // several records share calibration_date=2025-09-23; only created_at differs.
    const records = [
        { id: 56, calibration_date: '2025-09-23', created_at: '2026-03-05T11:23:39Z', expiry_date: '2026-01-23' }, // original, now expired
        { id: 108, calibration_date: '2025-09-23', created_at: '2026-08-24T12:39:32Z', expiry_date: '2026-09-22' }, // corrected/latest, still valid-ish
    ];
    const latest = pickLatestCalibrationRecord(records);
    assert.strictEqual(latest.id, 108, 'must pick the most recently created record when calibration_date ties');
    assert.strictEqual(getCurrentCalibrationStatus(records, TODAY), 'Due Soon');
    assert.notStrictEqual(getCurrentCalibrationStatus(records, TODAY), 'Expired');
});

test('G. Calibration history remains intact after status calculation (non-destructive)', () => {
    const records = [
        { id: 1, calibration_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z', expiry_date: '2026-01-01' },
        { id: 2, calibration_date: '2026-08-01', created_at: '2026-08-01T00:00:00Z', expiry_date: '2027-08-01' },
    ];
    const before = JSON.stringify(records);
    getCurrentCalibrationStatus(records, TODAY);
    assert.strictEqual(JSON.stringify(records), before, 'input records array must not be mutated');
    assert.strictEqual(records.length, 2, 'no records should be dropped');
});

test('H. Due-soon threshold: exactly 30 days -> Due Soon, 31 days -> Valid', () => {
    const at30 = [{ id: 1, calibration_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z', expiry_date: '2026-09-23' }]; // 30 days from 2026-08-24
    const at31 = [{ id: 1, calibration_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z', expiry_date: '2026-09-24' }]; // 31 days from 2026-08-24
    assert.strictEqual(getCurrentCalibrationStatus(at30, TODAY), 'Due Soon');
    assert.strictEqual(getCurrentCalibrationStatus(at31, TODAY), 'Valid');
});

test('Bug A regression: "Not Calibrated" status must never render as the green "Calibrated" badge', () => {
    assert.strictEqual(equipmentListBadgeLabel('Not Calibrated'), 'Not Calibrated');
    assert.notStrictEqual(equipmentListBadgeLabel('Not Calibrated'), 'Calibrated');
    assert.strictEqual(equipmentListBadgeLabel('Valid'), 'Calibrated');
    assert.strictEqual(equipmentListBadgeLabel('Expired'), 'Expired');
    assert.strictEqual(equipmentListBadgeLabel('Due Soon'), 'Due Soon');
});

test('classifyCalibrationStatus: null expiry_date on the latest record -> N/A (not Not Calibrated)', () => {
    const record = { id: 1, calibration_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z', expiry_date: null };
    assert.strictEqual(classifyCalibrationStatus(record, TODAY), 'N/A');
});

console.log(`\n${passed} test(s) passed.\n`);
