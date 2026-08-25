/**
 * Pure, dependency-free re-implementation of the "current calibration status" rule.
 *
 * This mirrors the corrected SQL logic in fix_calibration_latest_record_tiebreak.sql
 * (get_calibration_management / get_calibration_summary / get_available_report):
 *   1. Pick the latest applicable calibration_records row for an equipment item:
 *        ORDER BY calibration_date DESC, created_at DESC, id DESC LIMIT 1
 *      (the created_at/id tiebreak is the actual bug fix — without it, records that
 *      share the same calibration_date are picked non-deterministically).
 *   2. Classify that single record's expiry_date against "today":
 *        no record            -> 'Not Calibrated'
 *        expiry_date is null   -> 'N/A'
 *        expiry_date < today   -> 'Expired'
 *        expiry_date <= today+30d -> 'Due Soon'
 *        otherwise              -> 'Valid'
 *
 * Used only for regression testing the rule in JS; the SQL functions remain the actual
 * runtime source of truth (kept here so the tie-break rule can be unit tested without a
 * live database).
 */

function pickLatestCalibrationRecord(records) {
    if (!records || records.length === 0) return null;
    const sorted = [...records].sort((a, b) => {
        if (a.calibration_date !== b.calibration_date) {
            return a.calibration_date < b.calibration_date ? 1 : -1; // calibration_date DESC
        }
        if (a.created_at !== b.created_at) {
            return a.created_at < b.created_at ? 1 : -1; // created_at DESC (tiebreak)
        }
        return b.id - a.id; // id DESC (final tiebreak)
    });
    return sorted[0];
}

function classifyCalibrationStatus(record, todayStr, dueSoonDays = 30) {
    if (!record) return 'Not Calibrated';
    if (!record.expiry_date) return 'N/A';
    if (record.expiry_date < todayStr) return 'Expired';
    const today = new Date(todayStr + 'T00:00:00Z');
    const expiry = new Date(record.expiry_date + 'T00:00:00Z');
    const daysUntilExpiry = Math.round((expiry - today) / 86400000);
    if (daysUntilExpiry <= dueSoonDays) return 'Due Soon';
    return 'Valid';
}

function getCurrentCalibrationStatus(records, todayStr, dueSoonDays = 30) {
    return classifyCalibrationStatus(pickLatestCalibrationRecord(records), todayStr, dueSoonDays);
}

/**
 * Mirrors frontend/src/pages/Equipment.js's getCalibrationBadge() label decision (post-fix).
 * Kept here so the "Not Calibrated must never render as Calibrated" rule is regression-tested.
 */
function equipmentListBadgeLabel(calibrationStatus) {
    if (!calibrationStatus || calibrationStatus === 'N/A') return 'N/A';
    if (calibrationStatus === 'Not Calibrated') return 'Not Calibrated';
    if (calibrationStatus === 'Expired') return 'Expired';
    if (calibrationStatus === 'Due Soon') return 'Due Soon';
    return 'Calibrated';
}

module.exports = {
    pickLatestCalibrationRecord,
    classifyCalibrationStatus,
    getCurrentCalibrationStatus,
    equipmentListBadgeLabel,
};
