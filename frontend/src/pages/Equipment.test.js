import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import Equipment from './Equipment';
import { equipmentApi, categoriesApi, subcategoriesApi, calibrationApi } from '../services/api';

global.IS_REACT_ACT_ENVIRONMENT = true;

// Regression/feature coverage for: "Admin/Manager multi-select equipment +
// bulk edit selected equipment metadata" (Equipment Name, Description,
// Category, Subcategory, Manufacturer, Model only).
// NOTE: CRA's `resetMocks: true` strips mockImplementation before EVERY
// test, so implementations are (re-)applied in beforeEach, not the factory.
jest.mock('../services/api', () => ({
  equipmentApi: {
    getAll: jest.fn(),
    softDelete: jest.fn(),
    bulkUpdate: jest.fn(),
  },
  categoriesApi: { getAll: jest.fn() },
  subcategoriesApi: { getAll: jest.fn() },
  calibrationApi: { getStatus: jest.fn() },
}));

jest.mock('../context/OperatorContext', () => ({
  useOperator: jest.fn(),
}));

const { useOperator } = require('../context/OperatorContext');

const CATEGORIES = [
  { id: 1, name: 'Vibration', is_checkout_allowed: true, is_consumable: false },
  { id: 2, name: 'Thermal', is_checkout_allowed: true, is_consumable: false },
];

const SUBCATEGORIES_BY_CATEGORY = {
  1: [{ id: 10, name: 'Analyzers', category_id: 1 }, { id: 11, name: 'Sensors', category_id: 1 }],
  2: [{ id: 20, name: 'Cameras', category_id: 2 }],
};

const ALL_EQUIPMENT = [
  {
    id: 1, equipment_id: 'EQ-1', equipment_name: 'Analyzer A', description: 'First unit',
    category_id: 1, category_name: 'Vibration', subcategory_id: 10, subcategory_name: 'Analyzers',
    serial_number: 'SN-1', status: 'Available', is_consumable: false, is_checkout_allowed: true,
    manufacturer: 'SKF', model: 'CMXA 80', current_location: 'Store', current_holder: null, custom_fields: {},
  },
  {
    id: 2, equipment_id: 'EQ-2', equipment_name: 'Analyzer B', description: 'Second unit',
    category_id: 1, category_name: 'Vibration', subcategory_id: 10, subcategory_name: 'Analyzers',
    serial_number: 'SN-2', status: 'Available', is_consumable: false, is_checkout_allowed: true,
    manufacturer: 'SKF', model: 'CMXA 80', current_location: 'Store', current_holder: null, custom_fields: {},
  },
  {
    id: 3, equipment_id: 'EQ-3', equipment_name: 'Thermal Camera', description: 'Third unit',
    category_id: 2, category_name: 'Thermal', subcategory_id: 20, subcategory_name: 'Cameras',
    serial_number: 'SN-3', status: 'Available', is_consumable: false, is_checkout_allowed: true,
    manufacturer: 'Fluke', model: 'Ti480', current_location: 'Store', current_holder: null, custom_fields: {},
  },
];

function setInputValue(element, value) {
  const proto = Object.getPrototypeOf(element);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function setSelectValue(element, value) {
  const proto = Object.getPrototypeOf(element);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function renderEquipmentPage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Equipment />
      </MemoryRouter>
    );
  });
  // Flush the mount-time fetchCategories/fetchEquipment/calibration fetches.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return {
    container,
    unmount: () => act(async () => root.unmount()),
  };
}

function getRowCheckbox(container, equipmentId) {
  return container.querySelector(`input[aria-label="Select ${equipmentId}"]`);
}

function getSelectAllCheckbox(container) {
  return container.querySelector('input[aria-label="Select all visible equipment"]');
}

function getBulkEditButton(container) {
  return Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Bulk Edit');
}

function getClearSelectionButton(container) {
  return Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Clear Selection');
}

function getModalBody(container) {
  return container.querySelector('.modal-body');
}

function getBulkCheckboxByLabel(container, labelText) {
  const label = Array.from(getModalBody(container).querySelectorAll('label'))
    .find(l => l.textContent.trim() === labelText);
  return label.querySelector('input[type="checkbox"]');
}

function getBulkTextControlByLabel(container, labelText) {
  const label = Array.from(getModalBody(container).querySelectorAll('label'))
    .find(l => l.textContent.trim() === labelText);
  return label.closest('.form-group').querySelector('.form-input');
}

function getBulkSelectByLabel(container, labelText) {
  const group = Array.from(getModalBody(container).querySelectorAll('.form-group'))
    .find(g => {
      const label = g.querySelector('label');
      return label && label.textContent.trim() === labelText;
    });
  return group.querySelector('select');
}

function getSaveButton(container) {
  return Array.from(container.querySelectorAll('.modal-footer button')).find(b => b.textContent.trim() === 'Save');
}

function getConfirmUpdateButton(container) {
  return Array.from(container.querySelectorAll('.modal-footer button')).find(b => b.textContent.trim().startsWith('Update '));
}

describe('Equipment bulk edit', () => {
  beforeEach(() => {
    equipmentApi.getAll.mockReset().mockImplementation(async (params = {}) => {
      let items = ALL_EQUIPMENT;
      if (params.category_id) {
        items = items.filter(e => e.category_id.toString() === params.category_id.toString());
      }
      return { data: items.map(e => ({ ...e })) };
    });
    equipmentApi.softDelete.mockReset();
    equipmentApi.bulkUpdate.mockReset().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    categoriesApi.getAll.mockReset().mockResolvedValue({ data: CATEGORIES.map(c => ({ ...c })) });
    subcategoriesApi.getAll.mockReset().mockImplementation(async (categoryId) => ({
      data: (SUBCATEGORIES_BY_CATEGORY[categoryId] || []).map(s => ({ ...s })),
    }));
    calibrationApi.getStatus.mockReset().mockResolvedValue({ data: [] });
    useOperator.mockReset().mockReturnValue({ operator: { id: 1, full_name: 'Test Operator' }, operatorRole: 'manager' });
  });

  // PERMISSIONS
  test('Admin sees selection checkboxes', async () => {
    useOperator.mockReturnValue({ operator: { id: 1 }, operatorRole: 'admin' });
    const { container } = await renderEquipmentPage();
    expect(getSelectAllCheckbox(container)).toBeTruthy();
    expect(getRowCheckbox(container, 'EQ-1')).toBeTruthy();
  });

  test('Manager sees selection checkboxes', async () => {
    useOperator.mockReturnValue({ operator: { id: 1 }, operatorRole: 'manager' });
    const { container } = await renderEquipmentPage();
    expect(getSelectAllCheckbox(container)).toBeTruthy();
    expect(getRowCheckbox(container, 'EQ-1')).toBeTruthy();
  });

  test('Ordinary user does not see selection checkboxes', async () => {
    useOperator.mockReturnValue({ operator: { id: 1 }, operatorRole: 'user' });
    const { container } = await renderEquipmentPage();
    expect(getSelectAllCheckbox(container)).toBeNull();
    expect(getRowCheckbox(container, 'EQ-1')).toBeNull();
  });

  test('Ordinary user does not see Bulk Edit', async () => {
    useOperator.mockReturnValue({ operator: { id: 1 }, operatorRole: 'user' });
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1'); }); // no-op, checkbox doesn't exist
    expect(getBulkEditButton(container)).toBeUndefined();
  });

  // SELECTION
  test('selecting one row adds it to the selection', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    expect(container.textContent).toContain('1 selected');
  });

  test('selecting multiple rows works', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getRowCheckbox(container, 'EQ-2').click(); });
    expect(container.textContent).toContain('2 selected');
  });

  test('deselecting a row removes it from the selection', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getRowCheckbox(container, 'EQ-2').click(); });
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    expect(container.textContent).toContain('1 selected');
    expect(getRowCheckbox(container, 'EQ-2').checked).toBe(true);
  });

  test('Select All selects only currently filtered/visible rows, and does not silently expand after changing filters', async () => {
    const { container } = await renderEquipmentPage();
    // Filter to Vibration (category 1) - only EQ-1/EQ-2 visible.
    const categorySelects = Array.from(container.querySelectorAll('.form-select'));
    const categoryFilter = categorySelects.find(s => Array.from(s.options).some(o => o.textContent === 'Vibration'));
    await act(async () => {
      setSelectValue(categoryFilter, '1');
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => { getSelectAllCheckbox(container).click(); });
    expect(container.textContent).toContain('2 selected');

    // Now clear the category filter - EQ-3 becomes visible too, but selection
    // must NOT silently expand to include it.
    await act(async () => {
      setSelectValue(categoryFilter, '');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('2 selected');
    expect(getRowCheckbox(container, 'EQ-3').checked).toBe(false);
  });

  test('Clear Selection clears all selected ids', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getRowCheckbox(container, 'EQ-2').click(); });
    act(() => { getClearSelectionButton(container).click(); });
    expect(getBulkEditButton(container)).toBeUndefined();
    expect(getRowCheckbox(container, 'EQ-1').checked).toBe(false);
  });

  // BULK MODAL
  test('Bulk Edit opens with the selected count shown', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getRowCheckbox(container, 'EQ-2').click(); });
    act(() => { getBulkEditButton(container).click(); });
    expect(container.textContent).toContain('2 equipment records selected');
    expect(container.textContent).toContain('Bulk Edit Equipment');
  });

  test('all fields default to "Do not change"', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    expect(getBulkCheckboxByLabel(container, 'Update Equipment Name').checked).toBe(false);
    expect(getBulkSelectByLabel(container, 'Description').value).toBe('unchanged');
    expect(getBulkSelectByLabel(container, 'Category').value).toBe('');
    expect(getBulkCheckboxByLabel(container, 'Update Manufacturer').checked).toBe(false);
    expect(getBulkCheckboxByLabel(container, 'Update Model').checked).toBe(false);
  });

  test('Save is blocked when no fields are selected for change', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    // Disabled buttons don't fire onClick in jsdom, so this itself proves
    // submission is blocked; clicking it must never call the API.
    expect(getSaveButton(container).disabled).toBe(true);
    act(() => { getSaveButton(container).click(); });
    expect(equipmentApi.bulkUpdate).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Bulk Edit Equipment');
  });

  // NAME
  test('Bulk Equipment Name update accepts a shared name and is trimmed', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getRowCheckbox(container, 'EQ-2').click(); });
    act(() => { getBulkEditButton(container).click(); });
    act(() => { getBulkCheckboxByLabel(container, 'Update Equipment Name').click(); });
    act(() => { setInputValue(getBulkTextControlByLabel(container, 'Update Equipment Name'), '  Shared Name  '); });
    act(() => { getSaveButton(container).click(); });
    expect(container.textContent).toContain('You are about to update');
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(equipmentApi.bulkUpdate).toHaveBeenCalledWith([1, 2], { equipment_name: 'Shared Name' });
  });

  test('whitespace-only Equipment Name is rejected', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    act(() => { getBulkCheckboxByLabel(container, 'Update Equipment Name').click(); });
    act(() => { setInputValue(getBulkTextControlByLabel(container, 'Update Equipment Name'), '   '); });
    act(() => { getSaveButton(container).click(); });
    expect(container.textContent).toContain('Equipment Name cannot be blank.');
    expect(equipmentApi.bulkUpdate).not.toHaveBeenCalled();
  });

  // DESCRIPTION
  test('"Do not change" Description leaves it out of the payload', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    act(() => { getBulkCheckboxByLabel(container, 'Update Manufacturer').click(); });
    act(() => { setInputValue(getBulkTextControlByLabel(container, 'Update Manufacturer'), 'Emerson'); });
    act(() => { getSaveButton(container).click(); });
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const payload = equipmentApi.bulkUpdate.mock.calls[0][1];
    expect(payload).not.toHaveProperty('description');
  });

  test('"Set value" Description applies the value', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    act(() => { setSelectValue(getBulkSelectByLabel(container, 'Description'), 'set'); });
    const textarea = getModalBody(container).querySelector('textarea');
    act(() => { setInputValue(textarea, 'New shared description'); });
    act(() => { getSaveButton(container).click(); });
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(equipmentApi.bulkUpdate).toHaveBeenCalledWith([1], { description: 'New shared description' });
  });

  test('"Clear description" sends null', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    act(() => { setSelectValue(getBulkSelectByLabel(container, 'Description'), 'clear'); });
    act(() => { getSaveButton(container).click(); });
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(equipmentApi.bulkUpdate).toHaveBeenCalledWith([1], { description: null });
  });

  // CATEGORY / SUBCATEGORY
  test('Category + Subcategory selected together send valid ids', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    await act(async () => {
      setSelectValue(getBulkSelectByLabel(container, 'Category'), '2');
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => { setSelectValue(getBulkSelectByLabel(container, 'Subcategory'), '20'); });
    act(() => { getSaveButton(container).click(); });
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(equipmentApi.bulkUpdate).toHaveBeenCalledWith([1], { category_id: 2, subcategory_id: 20 });
  });

  test('changing Category without resolving Subcategory is blocked', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    await act(async () => {
      setSelectValue(getBulkSelectByLabel(container, 'Category'), '2');
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => { getSaveButton(container).click(); });
    expect(container.textContent).toContain('Select a subcategory');
    expect(equipmentApi.bulkUpdate).not.toHaveBeenCalled();
  });

  test('Clear Subcategory sends null', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    await act(async () => {
      setSelectValue(getBulkSelectByLabel(container, 'Category'), '2');
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => { setSelectValue(getBulkSelectByLabel(container, 'Subcategory'), '__clear__'); });
    act(() => { getSaveButton(container).click(); });
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(equipmentApi.bulkUpdate).toHaveBeenCalledWith([1], { category_id: 2, subcategory_id: null });
  });

  // MANUFACTURER / MODEL
  test('Manufacturer-only update does not alter Model', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    act(() => { getBulkCheckboxByLabel(container, 'Update Manufacturer').click(); });
    act(() => { setInputValue(getBulkTextControlByLabel(container, 'Update Manufacturer'), 'Emerson'); });
    act(() => { getSaveButton(container).click(); });
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(equipmentApi.bulkUpdate).toHaveBeenCalledWith([1], { manufacturer: 'Emerson' });
  });

  test('Model-only update does not alter Manufacturer', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    act(() => { getBulkCheckboxByLabel(container, 'Update Model').click(); });
    act(() => { setInputValue(getBulkTextControlByLabel(container, 'Update Model'), 'AMS 2140'); });
    act(() => { getSaveButton(container).click(); });
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(equipmentApi.bulkUpdate).toHaveBeenCalledWith([1], { model: 'AMS 2140' });
  });

  // PAYLOAD
  test('payload includes only explicitly changed fields (partial update example)', async () => {
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    act(() => { getBulkCheckboxByLabel(container, 'Update Manufacturer').click(); });
    act(() => { setInputValue(getBulkTextControlByLabel(container, 'Update Manufacturer'), 'Emerson'); });
    act(() => { getBulkCheckboxByLabel(container, 'Update Model').click(); });
    act(() => { setInputValue(getBulkTextControlByLabel(container, 'Update Model'), 'AMS 2140'); });
    act(() => { getSaveButton(container).click(); });
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const payload = equipmentApi.bulkUpdate.mock.calls[0][1];
    expect(payload).toEqual({ manufacturer: 'Emerson', model: 'AMS 2140' });
    expect(payload).not.toHaveProperty('equipment_id');
    expect(payload).not.toHaveProperty('serial_number');
    expect(payload).not.toHaveProperty('custom_fields');
  });

  // SUCCESS
  test('bulk update targets exactly the selected internal equipment.id values, refreshes the list, clears selection, and keeps active filters', async () => {
    const { container } = await renderEquipmentPage();
    // Filter to Vibration first.
    const categorySelects = Array.from(container.querySelectorAll('.form-select'));
    const categoryFilter = categorySelects.find(s => Array.from(s.options).some(o => o.textContent === 'Vibration'));
    await act(async () => {
      setSelectValue(categoryFilter, '1');
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getRowCheckbox(container, 'EQ-2').click(); });
    act(() => { getBulkEditButton(container).click(); });
    act(() => { getBulkCheckboxByLabel(container, 'Update Manufacturer').click(); });
    act(() => { setInputValue(getBulkTextControlByLabel(container, 'Update Manufacturer'), 'Emerson'); });
    act(() => { getSaveButton(container).click(); });
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    expect(equipmentApi.bulkUpdate).toHaveBeenCalledWith([1, 2], { manufacturer: 'Emerson' });
    // success message shown, modal closed, selection cleared
    expect(container.textContent).toContain('2 equipment records updated successfully.');
    expect(container.textContent).not.toContain('Bulk Edit Equipment');
    expect(getBulkEditButton(container)).toBeUndefined();
    // filter is still applied (category select still shows Vibration selected)
    expect(categoryFilter.value).toBe('1');
    // getAll was called again with the still-active category filter to refresh
    const lastCallParams = equipmentApi.getAll.mock.calls[equipmentApi.getAll.mock.calls.length - 1][0];
    expect(lastCallParams.category_id).toBe('1');
  });

  // FAILURE
  test('API failure keeps the modal open, preserves entered values, and shows a local error (no false success)', async () => {
    equipmentApi.bulkUpdate.mockReset().mockRejectedValue(new Error('Network error'));
    const { container } = await renderEquipmentPage();
    act(() => { getRowCheckbox(container, 'EQ-1').click(); });
    act(() => { getBulkEditButton(container).click(); });
    act(() => { getBulkCheckboxByLabel(container, 'Update Manufacturer').click(); });
    act(() => { setInputValue(getBulkTextControlByLabel(container, 'Update Manufacturer'), 'Emerson'); });
    act(() => { getSaveButton(container).click(); });
    act(() => { getConfirmUpdateButton(container).click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    expect(container.textContent).toContain('Bulk Edit Equipment');
    expect(container.textContent).toContain('Error updating equipment: Network error');
    expect(container.textContent).not.toContain('updated successfully');
    expect(getBulkCheckboxByLabel(container, 'Update Manufacturer').checked).toBe(true);
    expect(getBulkTextControlByLabel(container, 'Update Manufacturer').value).toBe('Emerson');
  });
});
