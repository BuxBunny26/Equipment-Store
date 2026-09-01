// Pure helpers for the Admin/Manager "bulk edit selected equipment" feature.
// Kept framework-free so the payload/validation rules can be unit tested
// directly, same convention as calibrationDelete.js / calibration_status_logic.js.

// Each field tracks whether it should be changed at all, so "do not change"
// (the default for every field) is always explicit rather than inferred from
// a blank value. Description/Subcategory additionally distinguish "set a
// value" from "clear to null", since a blank textarea would otherwise be
// ambiguous between the two.
export function createInitialBulkEditForm() {
  return {
    equipment_name: { enabled: false, value: '' },
    description: { action: 'unchanged', value: '' }, // unchanged | set | clear
    category_id: { action: 'unchanged', value: '' }, // unchanged | set
    subcategory_id: { action: 'unchanged', value: '' }, // unchanged | set | clear
    manufacturer: { enabled: false, value: '' },
    model: { enabled: false, value: '' },
  };
}

export function hasAnyBulkEditChange(form) {
  return (
    form.equipment_name.enabled ||
    form.description.action !== 'unchanged' ||
    form.category_id.action !== 'unchanged' ||
    form.manufacturer.enabled ||
    form.model.enabled
  );
}

// Returns a user-facing error string, or null if the form is valid and ready
// to submit. Never mutates the form.
export function getBulkEditValidationError(form) {
  if (!hasAnyBulkEditChange(form)) {
    return 'Select at least one field to update.';
  }
  if (form.equipment_name.enabled && form.equipment_name.value.trim() === '') {
    return 'Equipment Name cannot be blank.';
  }
  if (form.description.action === 'set' && form.description.value.trim() === '') {
    return 'Enter a description, or choose "Clear description" instead.';
  }
  if (form.category_id.action === 'set') {
    if (!form.category_id.value) {
      return 'Select a category.';
    }
    if (form.subcategory_id.action === 'unchanged') {
      return 'Select a subcategory, or choose "Clear Subcategory" for the new category.';
    }
    if (form.subcategory_id.action === 'set' && !form.subcategory_id.value) {
      return 'Select a subcategory, or choose "Clear Subcategory" for the new category.';
    }
  }
  if (form.manufacturer.enabled && form.manufacturer.value.trim() === '') {
    return 'Manufacturer cannot be blank.';
  }
  if (form.model.enabled && form.model.value.trim() === '') {
    return 'Model cannot be blank.';
  }
  return null;
}

// Builds the Supabase update payload containing ONLY the fields the user
// explicitly chose to change. Never includes equipment_id/serial_number/
// custom_fields — those are simply never modeled in the form at all.
export function buildBulkEditPayload(form) {
  const payload = {};
  if (form.equipment_name.enabled) {
    payload.equipment_name = form.equipment_name.value.trim();
  }
  if (form.description.action === 'set') {
    payload.description = form.description.value.trim();
  } else if (form.description.action === 'clear') {
    payload.description = null;
  }
  if (form.category_id.action === 'set') {
    payload.category_id = parseInt(form.category_id.value, 10);
    if (form.subcategory_id.action === 'set') {
      payload.subcategory_id = parseInt(form.subcategory_id.value, 10);
    } else if (form.subcategory_id.action === 'clear') {
      payload.subcategory_id = null;
    }
  }
  if (form.manufacturer.enabled) {
    payload.manufacturer = form.manufacturer.value.trim();
  }
  if (form.model.enabled) {
    payload.model = form.model.value.trim();
  }
  return payload;
}

// Human-readable "Field → value" lines for the confirmation step.
export function describeBulkEditChanges(form, categories = [], subcategories = []) {
  const lines = [];
  if (form.equipment_name.enabled) {
    lines.push(`Equipment Name \u2192 ${form.equipment_name.value.trim()}`);
  }
  if (form.description.action === 'set') {
    lines.push(`Description \u2192 ${form.description.value.trim()}`);
  } else if (form.description.action === 'clear') {
    lines.push('Description \u2192 (cleared)');
  }
  if (form.category_id.action === 'set') {
    const cat = categories.find(c => c.id.toString() === form.category_id.value.toString());
    lines.push(`Category \u2192 ${cat ? cat.name : form.category_id.value}`);
    if (form.subcategory_id.action === 'set') {
      const sub = subcategories.find(s => s.id.toString() === form.subcategory_id.value.toString());
      lines.push(`Subcategory \u2192 ${sub ? sub.name : form.subcategory_id.value}`);
    } else if (form.subcategory_id.action === 'clear') {
      lines.push('Subcategory \u2192 (cleared)');
    }
  }
  if (form.manufacturer.enabled) {
    lines.push(`Manufacturer \u2192 ${form.manufacturer.value.trim()}`);
  }
  if (form.model.enabled) {
    lines.push(`Model \u2192 ${form.model.value.trim()}`);
  }
  return lines;
}
