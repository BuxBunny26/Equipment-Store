import { pickCurrentCalibrationRecord } from './calibrationCurrent';

// Mirrors the tiebreak rule already applied server-side in
// backend/database/fix_calibration_latest_record_tiebreak.sql:
//   ORDER BY calibration_date DESC, created_at DESC, id DESC LIMIT 1
describe('pickCurrentCalibrationRecord', () => {
  test('one record: returns it', () => {
    const records = [{ id: 1, calibration_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z' }];
    expect(pickCurrentCalibrationRecord(records).id).toBe(1);
  });

  test('two different calibration dates: newer calibration_date wins', () => {
    const records = [
      { id: 1, calibration_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z' },
      { id: 2, calibration_date: '2026-01-01', created_at: '2025-01-01T00:00:00Z' },
    ];
    expect(pickCurrentCalibrationRecord(records).id).toBe(2);
  });

  test('same calibration_date: newer created_at wins', () => {
    const records = [
      { id: 1, calibration_date: '2025-09-23', created_at: '2026-03-05T11:23:39Z' },
      { id: 2, calibration_date: '2025-09-23', created_at: '2026-08-24T09:29:37Z' },
    ];
    expect(pickCurrentCalibrationRecord(records).id).toBe(2);
  });

  test('same calibration_date and created_at: higher id wins', () => {
    const records = [
      { id: 5, calibration_date: '2025-09-23', created_at: '2026-08-24T10:09:14Z' },
      { id: 9, calibration_date: '2025-09-23', created_at: '2026-08-24T10:09:14Z' },
    ];
    expect(pickCurrentCalibrationRecord(records).id).toBe(9);
  });

  test('older expired + newer valid: history preserves both, only newer marked current', () => {
    const records = [
      { id: 14, calibration_date: '2025-02-03', expiry_date: '2026-02-03', created_at: '2026-03-05T11:23:39Z' },
      { id: 74, calibration_date: '2026-08-06', expiry_date: '2027-08-05', created_at: '2026-08-24T08:58:37Z' },
    ];
    expect(records).toHaveLength(2);
    expect(pickCurrentCalibrationRecord(records).id).toBe(74);
  });

  // Live production fixture (equipment id=56, EQ-B2140140918/serial B2140140918) — 6 rows,
  // 5 of which share the exact same calibration_date/expiry_date (correction-cluster pattern).
  test('B2140140918-style cluster: all rows preserved, id 108 selected as current', () => {
    const records = [
      { id: 56, calibration_date: '2025-09-23', expiry_date: '2026-01-23', created_at: '2026-03-05T11:23:39.351153+00:00' },
      { id: 81, calibration_date: '2025-09-23', expiry_date: '2026-09-22', created_at: '2026-08-24T09:29:37.402769+00:00' },
      { id: 97, calibration_date: '2025-09-23', expiry_date: '2026-09-22', created_at: '2026-08-24T10:09:14.874449+00:00' },
      { id: 98, calibration_date: '2025-09-23', expiry_date: '2026-09-22', created_at: '2026-08-24T10:10:10.615486+00:00' },
      { id: 99, calibration_date: '2025-09-23', expiry_date: '2026-09-22', created_at: '2026-08-24T10:11:21.928515+00:00' },
      { id: 108, calibration_date: '2025-09-23', expiry_date: '2026-09-22', created_at: '2026-08-24T12:39:32.640707+00:00' },
    ];
    expect(records).toHaveLength(6);
    expect(pickCurrentCalibrationRecord(records).id).toBe(108);
  });

  test('zero records: returns null', () => {
    expect(pickCurrentCalibrationRecord([])).toBeNull();
    expect(pickCurrentCalibrationRecord(null)).toBeNull();
  });

  test('does not mutate or reorder the input array', () => {
    const records = [
      { id: 56, calibration_date: '2025-09-23', created_at: '2026-03-05T11:23:39.351153+00:00' },
      { id: 108, calibration_date: '2025-09-23', created_at: '2026-08-24T12:39:32.640707+00:00' },
      { id: 81, calibration_date: '2025-09-23', created_at: '2026-08-24T09:29:37.402769+00:00' },
    ];
    const originalOrder = records.map(r => r.id);
    const result = pickCurrentCalibrationRecord(records);
    expect(result.id).toBe(108);
    expect(records.map(r => r.id)).toEqual(originalOrder);
  });
});
