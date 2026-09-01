import {
  createInitialBulkEditForm,
  hasAnyBulkEditChange,
  getBulkEditValidationError,
  buildBulkEditPayload,
  describeBulkEditChanges,
} from './bulkEditEquipment';

describe('bulkEditEquipment pure logic', () => {
  test('createInitialBulkEditForm defaults every field to "do not change"', () => {
    const form = createInitialBulkEditForm();
    expect(form.equipment_name.enabled).toBe(false);
    expect(form.description.action).toBe('unchanged');
    expect(form.category_id.action).toBe('unchanged');
    expect(form.subcategory_id.action).toBe('unchanged');
    expect(form.manufacturer.enabled).toBe(false);
    expect(form.model.enabled).toBe(false);
    expect(hasAnyBulkEditChange(form)).toBe(false);
  });

  test('blocks submission when nothing is selected for change (no-op protection)', () => {
    const form = createInitialBulkEditForm();
    expect(getBulkEditValidationError(form)).toBe('Select at least one field to update.');
  });

  // NAME
  test('accepts a shared Equipment Name update', () => {
    const form = createInitialBulkEditForm();
    form.equipment_name = { enabled: true, value: 'Shared Name' };
    expect(getBulkEditValidationError(form)).toBeNull();
    expect(buildBulkEditPayload(form)).toEqual({ equipment_name: 'Shared Name' });
  });

  test('rejects a whitespace-only Equipment Name', () => {
    const form = createInitialBulkEditForm();
    form.equipment_name = { enabled: true, value: '   ' };
    expect(getBulkEditValidationError(form)).toBe('Equipment Name cannot be blank.');
  });

  test('trims Equipment Name before building the payload', () => {
    const form = createInitialBulkEditForm();
    form.equipment_name = { enabled: true, value: '  Trimmed  ' };
    expect(buildBulkEditPayload(form).equipment_name).toBe('Trimmed');
  });

  // DESCRIPTION
  test('"Do not change" Description omits the field from the payload entirely', () => {
    const form = createInitialBulkEditForm();
    expect(buildBulkEditPayload(form)).not.toHaveProperty('description');
  });

  test('"Set value" Description applies the trimmed value', () => {
    const form = createInitialBulkEditForm();
    form.description = { action: 'set', value: '  New description  ' };
    expect(getBulkEditValidationError(form)).toBeNull();
    expect(buildBulkEditPayload(form)).toEqual({ description: 'New description' });
  });

  test('blank "Set value" Description is rejected rather than silently saved', () => {
    const form = createInitialBulkEditForm();
    form.description = { action: 'set', value: '   ' };
    expect(getBulkEditValidationError(form)).toBe('Enter a description, or choose "Clear description" instead.');
  });

  test('"Clear description" sends null', () => {
    const form = createInitialBulkEditForm();
    form.description = { action: 'clear', value: '' };
    expect(getBulkEditValidationError(form)).toBeNull();
    expect(buildBulkEditPayload(form)).toEqual({ description: null });
  });

  // CATEGORY / SUBCATEGORY
  test('Category + Subcategory selected together send both valid ids', () => {
    const form = createInitialBulkEditForm();
    form.category_id = { action: 'set', value: '3' };
    form.subcategory_id = { action: 'set', value: '9' };
    expect(getBulkEditValidationError(form)).toBeNull();
    expect(buildBulkEditPayload(form)).toEqual({ category_id: 3, subcategory_id: 9 });
  });

  test('changing Category without resolving Subcategory is blocked', () => {
    const form = createInitialBulkEditForm();
    form.category_id = { action: 'set', value: '3' };
    // subcategory_id.action left as 'unchanged' - must be blocked
    expect(getBulkEditValidationError(form)).toBe(
      'Select a subcategory, or choose "Clear Subcategory" for the new category.'
    );
  });

  test('Clear Subcategory sends null alongside the new category', () => {
    const form = createInitialBulkEditForm();
    form.category_id = { action: 'set', value: '3' };
    form.subcategory_id = { action: 'clear', value: '' };
    expect(getBulkEditValidationError(form)).toBeNull();
    expect(buildBulkEditPayload(form)).toEqual({ category_id: 3, subcategory_id: null });
  });

  test('"Do not change" Category never includes category_id/subcategory_id in the payload', () => {
    const form = createInitialBulkEditForm();
    expect(buildBulkEditPayload(form)).not.toHaveProperty('category_id');
    expect(buildBulkEditPayload(form)).not.toHaveProperty('subcategory_id');
  });

  // MANUFACTURER / MODEL
  test('Manufacturer-only update does not include Model', () => {
    const form = createInitialBulkEditForm();
    form.manufacturer = { enabled: true, value: 'Emerson' };
    expect(getBulkEditValidationError(form)).toBeNull();
    const payload = buildBulkEditPayload(form);
    expect(payload).toEqual({ manufacturer: 'Emerson' });
    expect(payload).not.toHaveProperty('model');
  });

  test('Model-only update does not include Manufacturer', () => {
    const form = createInitialBulkEditForm();
    form.model = { enabled: true, value: 'AMS 2140' };
    expect(getBulkEditValidationError(form)).toBeNull();
    const payload = buildBulkEditPayload(form);
    expect(payload).toEqual({ model: 'AMS 2140' });
    expect(payload).not.toHaveProperty('manufacturer');
  });

  test('blank Manufacturer is rejected when enabled', () => {
    const form = createInitialBulkEditForm();
    form.manufacturer = { enabled: true, value: '  ' };
    expect(getBulkEditValidationError(form)).toBe('Manufacturer cannot be blank.');
  });

  test('blank Model is rejected when enabled', () => {
    const form = createInitialBulkEditForm();
    form.model = { enabled: true, value: '  ' };
    expect(getBulkEditValidationError(form)).toBe('Model cannot be blank.');
  });

  // PAYLOAD SAFETY
  test('payload never includes equipment_id, serial_number or custom_fields/channels', () => {
    const form = createInitialBulkEditForm();
    form.equipment_name = { enabled: true, value: 'Name' };
    form.description = { action: 'clear', value: '' };
    form.category_id = { action: 'set', value: '1' };
    form.subcategory_id = { action: 'set', value: '2' };
    form.manufacturer = { enabled: true, value: 'Emerson' };
    form.model = { enabled: true, value: 'AMS 2140' };
    const payload = buildBulkEditPayload(form);
    expect(payload).not.toHaveProperty('equipment_id');
    expect(payload).not.toHaveProperty('serial_number');
    expect(payload).not.toHaveProperty('custom_fields');
    expect(payload).not.toHaveProperty('channels');
  });

  test('example scenario: only Manufacturer + Model are updated, everything else omitted', () => {
    const form = createInitialBulkEditForm();
    form.manufacturer = { enabled: true, value: 'Emerson' };
    form.model = { enabled: true, value: 'AMS 2140' };
    const payload = buildBulkEditPayload(form);
    expect(payload).toEqual({ manufacturer: 'Emerson', model: 'AMS 2140' });
  });

  // CONFIRMATION SUMMARY
  test('describeBulkEditChanges renders human-readable field -> value lines', () => {
    const form = createInitialBulkEditForm();
    form.manufacturer = { enabled: true, value: 'Emerson' };
    form.model = { enabled: true, value: 'AMS 2140' };
    const lines = describeBulkEditChanges(form, [], []);
    expect(lines).toEqual([
      'Manufacturer \u2192 Emerson',
      'Model \u2192 AMS 2140',
    ]);
  });

  test('describeBulkEditChanges resolves category/subcategory names when available', () => {
    const form = createInitialBulkEditForm();
    form.category_id = { action: 'set', value: '3' };
    form.subcategory_id = { action: 'set', value: '9' };
    const lines = describeBulkEditChanges(
      form,
      [{ id: 3, name: 'Vibration' }],
      [{ id: 9, name: 'AMS Analyzer' }]
    );
    expect(lines).toEqual(['Category \u2192 Vibration', 'Subcategory \u2192 AMS Analyzer']);
  });
});
