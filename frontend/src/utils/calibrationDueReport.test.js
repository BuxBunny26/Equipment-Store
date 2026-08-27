import { filterCalibrationDueRows } from './calibrationDueReport';

// Rows here use the shape returned by the get_calibration_management RPC (one row per
// equipment, current status already derived server-side from the latest calibration record).
describe('filterCalibrationDueRows', () => {
  test('older expired + newer valid (as one equipment row): absent when current status is valid', () => {
    const rows = [
      { equipment_id: 1, equipment_code: 'EQ-1', calibration_record_id: 2, calibration_status: 'Valid',
        last_calibration_date: '2026-05-01', calibration_expiry_date: '2027-05-01' },
    ];
    expect(filterCalibrationDueRows(rows)).toHaveLength(0);
  });

  test('older expired + newer due soon: appears once as Due Soon', () => {
    const rows = [
      { equipment_id: 56, equipment_code: 'EQ-B2140140918', calibration_record_id: 108, calibration_status: 'Due Soon',
        last_calibration_date: '2025-09-23', calibration_expiry_date: '2026-09-22',
        equipment_name: 'AMS2140 Analyzer', category: 'Vibration', serial_number: 'B2140140918',
        certificate_number: '', calibration_provider: 'Emerson' },
    ];
    const result = filterCalibrationDueRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 108, equipment_code: 'EQ-B2140140918', calibration_status: 'Due Soon', expiry_date: '2026-09-22' });
  });

  test('current expired: appears once', () => {
    const rows = [
      { equipment_id: 2, equipment_code: 'EQ-2', calibration_record_id: 20, calibration_status: 'Expired',
        last_calibration_date: '2024-01-01', calibration_expiry_date: '2025-01-01' },
    ];
    const result = filterCalibrationDueRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].calibration_status).toBe('Expired');
  });

  test('current valid: absent', () => {
    const rows = [
      { equipment_id: 3, equipment_code: 'EQ-3', calibration_record_id: 30, calibration_status: 'Valid',
        last_calibration_date: '2026-06-01', calibration_expiry_date: '2027-06-01' },
    ];
    expect(filterCalibrationDueRows(rows)).toHaveLength(0);
  });

  test('no records (Not Calibrated): absent', () => {
    const rows = [
      { equipment_id: 4, equipment_code: 'EQ-4', calibration_record_id: null, calibration_status: 'Not Calibrated',
        last_calibration_date: null, calibration_expiry_date: null },
    ];
    expect(filterCalibrationDueRows(rows)).toHaveLength(0);
  });

  test('mixed set: one row per equipment, only Expired/Due Soon retained', () => {
    const rows = [
      { equipment_id: 1, calibration_record_id: 10, calibration_status: 'Valid' },
      { equipment_id: 2, calibration_record_id: 20, calibration_status: 'Expired' },
      { equipment_id: 3, calibration_record_id: 30, calibration_status: 'Due Soon' },
      { equipment_id: 4, calibration_record_id: null, calibration_status: 'Not Calibrated' },
      { equipment_id: 5, calibration_record_id: 50, calibration_status: 'N/A' },
    ];
    const result = filterCalibrationDueRows(rows);
    expect(result.map(r => r.id).sort()).toEqual([20, 30]);
  });
});
