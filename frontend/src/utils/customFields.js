// Equipment custom fields — model-specific attributes
// Add more entries here to enable custom fields for other equipment models.

export const CUSTOM_FIELD_RULES = [
  {
    // Backward compatibility: equipment already named e.g. "AMS2140
    // Analyzer" must keep matching even when its Model field is blank.
    keywords: ['AMS2140'],
    // Model-based detection: matches "2140", "AMS 2140", "AMS2140",
    // "AMS-2140", "Emerson AMS 2140", case-insensitively, tolerating
    // normal spaces/hyphens. A "2140" that's part of a larger/different
    // number (e.g. "21400", "12140") is deliberately NOT a match.
    modelPattern: /(?<!\d)2140(?!\d)/,
    field: 'channels',
    label: 'Number of Channels',
    options: ['1 Channel', '2 Channel', '4 Channel'],
    badgeSuffix: 'Ch',  // used in list: "2 Ch"
  },
];

// Uppercases and strips spaces/hyphens so "AMS 2140", "AMS-2140" and
// "AMS2140" all normalize to the same token for matching.
function normalizeForMatch(str) {
  return (str || '').toUpperCase().replace(/[\s-]+/g, '');
}

// Returns the matching custom-field rule for a piece of equipment, or null.
// `model` is checked first (e.g. Add Equipment's Model field); `equipmentName`
// is checked as a fallback so existing equipment named e.g. "AMS2140
// Analyzer" keeps matching even without a Model value.
export function getCustomFieldRule(equipmentName, model) {
  const normalizedModel = normalizeForMatch(model);
  const normalizedName = normalizeForMatch(equipmentName);
  return CUSTOM_FIELD_RULES.find(rule => {
    if (normalizedModel && rule.modelPattern && rule.modelPattern.test(normalizedModel)) {
      return true;
    }
    if (normalizedName && rule.keywords.some(kw => normalizedName.includes(normalizeForMatch(kw)))) {
      return true;
    }
    return false;
  }) || null;
}

// Extracts the value of a field from custom_fields JSON
export function getCustomFieldValue(customFields, field) {
  if (!customFields) return null;
  try {
    const parsed = typeof customFields === 'string' ? JSON.parse(customFields) : customFields;
    return parsed[field] ?? null;
  } catch {
    return null;
  }
}
