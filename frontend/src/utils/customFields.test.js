import { getCustomFieldRule, getCustomFieldValue } from './customFields';

// Regression coverage for: AMS2140 "Number of Channels" detection must work
// off the Add Equipment Model field, not just Equipment Name, while staying
// backward compatible with equipment already identified by name alone.
describe('getCustomFieldRule — AMS2140 model/name detection', () => {
  test.each([
    ['2140'],
    ['AMS 2140'],
    ['AMS2140'],
    ['AMS-2140'],
    ['Emerson AMS 2140'],
    ['ams 2140'],
    ['emerson ams2140'],
  ])('matches via model="%s"', (model) => {
    const rule = getCustomFieldRule('', model);
    expect(rule).not.toBeNull();
    expect(rule.field).toBe('channels');
  });

  test('backward compatible: equipment_name alone still matches when model is missing', () => {
    const rule = getCustomFieldRule('AMS2140 Vibration Analyzer', undefined);
    expect(rule).not.toBeNull();
    expect(rule.field).toBe('channels');
  });

  test('backward compatible: equipment_name alone still matches when model is an empty string', () => {
    const rule = getCustomFieldRule('AMS2140 Analyzer', '');
    expect(rule).not.toBeNull();
  });

  test.each([
    ['CMXA 80'],
    ['Fluke Ti480'],
    ['21400'], // 2140 embedded in a different/larger number must not match
    ['AMS12140'],
  ])('does not match model="%s"', (model) => {
    expect(getCustomFieldRule('', model)).toBeNull();
  });

  test('does not match blank model and blank equipment name', () => {
    expect(getCustomFieldRule('', '')).toBeNull();
    expect(getCustomFieldRule(undefined, undefined)).toBeNull();
    expect(getCustomFieldRule(null, null)).toBeNull();
  });

  test('does not match an unrelated equipment name/model pair', () => {
    expect(getCustomFieldRule('Vibration Analyzer', 'CMXA 80')).toBeNull();
  });

  test('rule exposes the expected channel options and required label', () => {
    const rule = getCustomFieldRule('', 'AMS 2140');
    expect(rule.label).toBe('Number of Channels');
    expect(rule.options).toEqual(['1 Channel', '2 Channel', '4 Channel']);
  });
});

describe('getCustomFieldValue', () => {
  test('reads a value out of a custom_fields object', () => {
    expect(getCustomFieldValue({ channels: '4 Channel' }, 'channels')).toBe('4 Channel');
  });

  test('reads a value out of a custom_fields JSON string', () => {
    expect(getCustomFieldValue('{"channels":"2 Channel"}', 'channels')).toBe('2 Channel');
  });

  test('returns null when custom_fields is missing/empty', () => {
    expect(getCustomFieldValue(null, 'channels')).toBeNull();
    expect(getCustomFieldValue(undefined, 'channels')).toBeNull();
  });

  test('returns null when the field is not present', () => {
    expect(getCustomFieldValue({}, 'channels')).toBeNull();
  });
});
