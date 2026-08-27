// Maps get_calibration_management() RPC rows (one row per equipment, current status already
// derived server-side) into the row shape the Calibration Due report expects, keeping ONLY
// equipment whose current derived status is Expired or Due Soon. This replaces the previous
// direct calibration_records query that filtered on the frozen, insert-time-only
// calibration_status column (which could surface stale/superseded rows forever).
export function filterCalibrationDueRows(managementRows) {
  return (managementRows || [])
    .filter(r => r.calibration_status === 'Expired' || r.calibration_status === 'Due Soon')
    .map(r => ({
      id: r.calibration_record_id,
      equipment_code: r.equipment_code,
      equipment_name: r.equipment_name,
      category: r.category,
      serial_number: r.serial_number,
      certificate_number: r.certificate_number,
      calibration_provider: r.calibration_provider,
      calibration_date: r.last_calibration_date,
      expiry_date: r.calibration_expiry_date,
      calibration_status: r.calibration_status,
    }));
}
