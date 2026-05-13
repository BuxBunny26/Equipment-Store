// Equipment custom fields — model-specific attributes
// Add more entries here to enable custom fields for other equipment models.

export const CUSTOM_FIELD_RULES = [
  {
    keywords: ['AMS2140'],
    field: 'channels',
    label: 'Channels',
    options: ['1 Channel', '2 Channel', '4 Channel'],
    badgeSuffix: 'Ch',  // used in list: "2 Ch"
  },
];

// Returns the matching rule for an equipment name, or null
export function getCustomFieldRule(equipmentName) {
  if (!equipmentName) return null;
  const name = equipmentName.toUpperCase();
  return CUSTOM_FIELD_RULES.find(rule =>
    rule.keywords.some(kw => name.includes(kw.toUpperCase()))
  ) || null;
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
