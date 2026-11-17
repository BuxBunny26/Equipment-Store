/**
 * Pure validation for the calibration soft-delete flow. Kept separate from
 * services/api.js so the "a deletion reason is required" rule can be unit
 * tested without a Supabase client.
 */
export function validateDeletionReason(reason) {
  const trimmed = (reason || '').trim();
  if (!trimmed) {
    throw new Error('A deletion reason is required.');
  }
  return trimmed;
}
