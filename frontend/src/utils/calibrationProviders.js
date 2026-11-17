/**
 * Pure helpers for deduping/suggesting calibration provider names (e.g. "WearCheck" vs
 * "Wearcheck" vs "WEARCHECK" vs "wearcheck" vs "wear check" all referring to the same lab).
 * No Supabase/network access here -- callers (Calibration.js, EquipmentDetail.js,
 * Settings.js) fetch the raw { name, count } list via calibrationApi.getProviders() and pass
 * it in, keeping this fully unit-testable.
 */

// Case/whitespace-insensitive key used to detect "the same provider, different spelling":
// trims, lowercases, and strips ALL internal whitespace -- not just collapses it -- so e.g.
// "WearCheck", "Wearcheck", "WEARCHECK", "wearcheck" and "wear check" all produce the same
// key. This is deliberately whitespace-agnostic rather than whitespace-collapsing, since
// "wear check" (with a space) is a realistic typo for "WearCheck" that should still match.
export function normalizeProviderName(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Groups a { name, count }[] list (from calibrationApi.getProviders()) by normalized name.
 * Each group is { key, variants, totalCount, hasDuplicates }, sorted by totalCount desc, with
 * variants sorted by count desc. Only groups with more than one distinct spelling have
 * hasDuplicates=true -- these are the ones worth surfacing to an admin for consolidation.
 */
export function groupProvidersByNormalizedName(providers) {
  const groups = new Map();
  for (const p of providers || []) {
    const key = normalizeProviderName(p.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return Array.from(groups.entries())
    .map(([key, variants]) => {
      const sortedVariants = [...variants].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      return {
        key,
        variants: sortedVariants,
        totalCount: sortedVariants.reduce((sum, v) => sum + v.count, 0),
        hasDuplicates: sortedVariants.length > 1,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount);
}

/**
 * While typing a new/edited provider name, finds an already-used spelling that's the "same"
 * provider (normalizes equal) but not byte-identical -- e.g. typing "wearcheck" when
 * "WearCheck" is already on file. Returns that existing exact spelling, or null if the typed
 * value is new or already matches an existing spelling exactly. Used to power a non-blocking
 * "Did you mean ...?" suggestion, never to block submission -- the user must stay free to
 * enter a genuinely new provider.
 */
export function findSimilarProvider(typedName, existingNames) {
  const typed = (typedName || '').trim();
  if (!typed) return null;
  const typedKey = normalizeProviderName(typed);
  for (const existing of existingNames || []) {
    if (existing === typed) return null; // exact match already -- nothing to suggest
    if (normalizeProviderName(existing) === typedKey) return existing;
  }
  return null;
}
