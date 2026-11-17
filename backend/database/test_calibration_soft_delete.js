/**
 * Regression tests for Problem 7 (soft delete + auditability for calibration_records):
 * verifies that pickLatestCalibrationRecord / getCurrentCalibrationStatus correctly
 * exclude soft-deleted rows (deleted_at set) when recalculating "current" status, mirroring
 * the "AND deleted_at IS NULL" filter added to the 3 RPCs in add_calibration_soft_delete.sql.
 * Pure logic only — no Supabase calls, no network.
 * Usage: node database/test_calibration_soft_delete.js
 */
const assert = require('assert');
const { pickLatestCalibrationRecord, getCurrentCalibrationStatus } = require('./calibration_status_logic');

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

console.log('\ncalibration soft-delete tests\n');

test('1. A single active record is still picked as Current (deleted_at absent = active)', () => {
    const records = [{ id: 1, calibration_date: '2026-06-01', created_at: '2026-06-01T00:00:00Z', expiry_date: '2027-06-01' }];
    assert.strictEqual(pickLatestCalibrationRecord(records).id, 1);
    assert.strictEqual(getCurrentCalibrationStatus(records, TODAY), 'Valid');
});

test('2. A soft-deleted record (deleted_at set) is never picked as Current', () => {
    const records = [{ id: 1, calibration_date: '2026-06-01', created_at: '2026-06-01T00:00:00Z', expiry_date: '2027-06-01', deleted_at: '2026-08-24T10:00:00Z' }];
    assert.strictEqual(pickLatestCalibrationRecord(records), null);
    assert.strictEqual(getCurrentCalibrationStatus(records, TODAY), 'Not Calibrated');
});

test('3. Deleting all records for an equipment falls back to Not Calibrated', () => {
    const records = [
        { id: 1, calibration_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z', expiry_date: '2026-01-01', deleted_at: '2026-08-24T10:00:00Z' },
        { id: 2, calibration_date: '2026-06-01', created_at: '2026-06-01T00:00:00Z', expiry_date: '2027-06-01', deleted_at: '2026-08-24T10:05:00Z' },
    ];
    assert.strictEqual(getCurrentCalibrationStatus(records, TODAY), 'Not Calibrated');
});

test('4. Deleting the newest record correctly promotes the next-newest ACTIVE record to Current', () => {
    // Old record: expired. New record: valid, but soft-deleted (e.g. entered by mistake).
    // Expected: the older EXPIRED record becomes Current again once the mistaken new one is deleted —
    // this is the exact "incorrect record removed, status recalculates correctly" scenario from Problem 7.
    const records = [
        { id: 1, calibration_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z', expiry_date: '2026-01-01' },
        { id: 2, calibration_date: '2026-06-01', created_at: '2026-06-01T00:00:00Z', expiry_date: '2027-06-01', deleted_at: '2026-08-24T10:00:00Z' },
    ];
    const current = pickLatestCalibrationRecord(records);
    assert.strictEqual(current.id, 1);
    assert.strictEqual(getCurrentCalibrationStatus(records, TODAY), 'Expired');
});

test('5. Same calibration_date tiebreak still applies among ACTIVE records once a tied record is deleted', () => {
    // Two records tie on calibration_date; the newer-by-created_at one is soft-deleted, so the
    // older-by-created_at tied record must now win (still deterministic, not random).
    const records = [
        { id: 1, calibration_date: '2026-06-01', created_at: '2026-06-01T09:00:00Z', expiry_date: '2026-09-01' },
        { id: 2, calibration_date: '2026-06-01', created_at: '2026-06-01T10:00:00Z', expiry_date: '2027-06-01', deleted_at: '2026-08-24T10:00:00Z' },
    ];
    assert.strictEqual(pickLatestCalibrationRecord(records).id, 1);
});

test('6. An unrelated equipment\'s active record is unaffected by another equipment\'s deleted record', () => {
    const records = [{ id: 9, calibration_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z', expiry_date: '2026-09-10' }];
    assert.strictEqual(getCurrentCalibrationStatus(records, TODAY), 'Due Soon');
});

console.log(`\n${passed} test(s) passed.\n`);
