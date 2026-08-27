// Selects the "current" calibration record for an equipment's history, using the SAME
// tiebreak rule as the backend RPCs (get_calibration_management / get_calibration_summary /
// get_available_report — see backend/database/fix_calibration_latest_record_tiebreak.sql):
//   ORDER BY calibration_date DESC, created_at DESC, id DESC LIMIT 1
// Kept as a single shared helper so Calibration.js and EquipmentDetail.js never drift apart
// on which row they consider "current".
export function pickCurrentCalibrationRecord(records) {
  if (!records || records.length === 0) return null;
  const sorted = [...records].sort((a, b) => {
    if (a.calibration_date !== b.calibration_date) {
      return (a.calibration_date || '') < (b.calibration_date || '') ? 1 : -1;
    }
    if (a.created_at !== b.created_at) {
      return (a.created_at || '') < (b.created_at || '') ? 1 : -1;
    }
    return (b.id || 0) - (a.id || 0);
  });
  return sorted[0];
}
