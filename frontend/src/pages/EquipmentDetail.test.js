import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EquipmentDetail from './EquipmentDetail';
import { equipmentApi, calibrationApi, categoriesApi, subcategoriesApi } from '../services/api';

global.IS_REACT_ACT_ENVIRONMENT = true;

// Regression coverage for: "Add Calibration from Equipment Detail page" --
// users must be able to add a calibration record directly from the
// Calibration tab (button visible whether zero or existing records exist),
// with the equipment pre-fixed (no search/selection needed) and reusing the
// exact same date-input UX/validation/10MB file rule as the existing Add
// Calibration workflow in Calibration.js.
// NOTE: CRA's default Jest config sets `resetMocks: true`, which strips any
// mockImplementation before EVERY test, so implementations are (re-)applied
// in beforeEach below rather than baked into the jest.mock() factory.
jest.mock('../services/api', () => ({
  equipmentApi: {
    getById: jest.fn(),
    getHistory: jest.fn(),
    update: jest.fn(),
  },
  calibrationApi: {
    getHistory: jest.fn(),
    create: jest.fn(),
  },
  categoriesApi: { getAll: jest.fn() },
  subcategoriesApi: { getAll: jest.fn() },
}));

jest.mock('../context/OperatorContext', () => ({
  useOperator: () => ({ operator: { id: 1, full_name: 'Test Operator' }, operatorRole: 'operator' }),
}));

const baseEquipment = {
  id: 42,
  equipment_id: 'EQ-TEST-0042',
  equipment_name: 'Test Analyser',
  serial_number: 'SN-1234',
  description: 'A test unit',
  category_name: 'Analysers',
  subcategory_name: 'Sub A',
  status: 'Available',
  is_checkout_allowed: true,
  is_consumable: false,
  is_quantity_tracked: false,
  custom_fields: {},
};

function setInputValue(element, value) {
  const proto = Object.getPrototypeOf(element);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

async function renderDetail() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/equipment/42']}>
        <Routes>
          <Route path="/equipment/:id" element={<EquipmentDetail />} />
        </Routes>
      </MemoryRouter>
    );
  });
  // Flush the mount-time getById/getHistory/getHistory(calibration) fetches.
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

function openModal(container) {
  const btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === '+ Add Calibration');
  act(() => { btn.click(); });
}

function getModalInput(container, labelText) {
  const label = Array.from(container.querySelectorAll('label')).find(l => l.textContent.trim() === labelText);
  return label.parentElement.querySelector('input, textarea');
}

function submitForm(container) {
  const form = container.querySelector('form');
  act(() => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}

describe('EquipmentDetail Add Calibration', () => {
  beforeEach(() => {
    equipmentApi.getById.mockReset().mockResolvedValue({ data: { ...baseEquipment } });
    equipmentApi.getHistory.mockReset().mockResolvedValue({ data: [] });
    calibrationApi.getHistory.mockReset().mockResolvedValue({ data: [] });
    calibrationApi.create.mockReset().mockResolvedValue({ data: { id: 999 } });
    categoriesApi.getAll.mockReset().mockResolvedValue({ data: [] });
    subcategoriesApi.getAll.mockReset().mockResolvedValue({ data: [] });
  });

  test('"+ Add Calibration" button is visible with zero calibration records', async () => {
    const { container, unmount } = await renderDetail();

    // Switch to the Calibration tab.
    const tabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Calibration ('));
    await act(async () => { tabBtn.click(); });

    expect(container.textContent).toContain('No calibration records');
    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === '+ Add Calibration');
    expect(addBtn).toBeTruthy();

    await unmount();
    container.remove();
  });

  test('"+ Add Calibration" button is visible with existing calibration records', async () => {
    calibrationApi.getHistory.mockResolvedValue({
      data: [{ id: 1, calibration_date: '2026-01-01', expiry_date: '2027-01-01', certificate_number: 'CAL-1', created_at: '2026-01-01T00:00:00Z' }],
    });
    const { container, unmount } = await renderDetail();

    const tabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Calibration ('));
    await act(async () => { tabBtn.click(); });

    expect(container.textContent).not.toContain('No calibration records');
    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === '+ Add Calibration');
    expect(addBtn).toBeTruthy();

    await unmount();
    container.remove();
  });

  test('opening the modal pre-fixes the equipment and defaults the calibration date to today', async () => {
    const { container, unmount } = await renderDetail();
    const tabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Calibration ('));
    await act(async () => { tabBtn.click(); });

    openModal(container);

    expect(container.textContent).toContain('Test Analyser');
    expect(container.textContent).toContain('EQ-TEST-0042');
    // No equipment search/selection input should exist in the modal.
    expect(container.querySelector('.modal select')).toBeNull();

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const expectedDisplay = `${dd}/${mm}/${yyyy}`;

    const calDateInput = getModalInput(container, 'Calibration Date *');
    expect(calDateInput.value).toBe(expectedDisplay);

    await unmount();
    container.remove();
  });

  test('invalid calendar date (31/04/2026) is rejected without calling calibrationApi.create', async () => {
    const { container, unmount } = await renderDetail();
    const tabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Calibration ('));
    await act(async () => { tabBtn.click(); });
    openModal(container);

    const calDateInput = getModalInput(container, 'Calibration Date *');
    const expiryInput = getModalInput(container, 'Expiry Date *');
    act(() => { setInputValue(calDateInput, '31042026'); });
    act(() => { setInputValue(expiryInput, '31122027'); });

    submitForm(container);

    expect(calibrationApi.create).not.toHaveBeenCalled();
    expect(container.textContent).toContain('valid date');

    await unmount();
    container.remove();
  });

  test('expiry date before calibration date is rejected without calling calibrationApi.create', async () => {
    const { container, unmount } = await renderDetail();
    const tabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Calibration ('));
    await act(async () => { tabBtn.click(); });
    openModal(container);

    const calDateInput = getModalInput(container, 'Calibration Date *');
    const expiryInput = getModalInput(container, 'Expiry Date *');
    act(() => { setInputValue(calDateInput, '15062026'); });
    act(() => { setInputValue(expiryInput, '01012026'); });

    submitForm(container);

    expect(calibrationApi.create).not.toHaveBeenCalled();
    expect(container.textContent).toContain('cannot be before');

    await unmount();
    container.remove();
  });

  test('certificate file over 10MB is rejected without calling calibrationApi.create', async () => {
    const { container, unmount } = await renderDetail();
    const tabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Calibration ('));
    await act(async () => { tabBtn.click(); });
    openModal(container);

    const calDateInput = getModalInput(container, 'Calibration Date *');
    const expiryInput = getModalInput(container, 'Expiry Date *');
    act(() => { setInputValue(calDateInput, '15062026'); });
    act(() => { setInputValue(expiryInput, '15062027'); });

    const fileInput = container.querySelector('input[type="file"]');
    const bigFile = new File(['x'.repeat(10)], 'cert.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });
    Object.defineProperty(fileInput, 'files', { value: [bigFile] });
    act(() => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });

    submitForm(container);

    expect(calibrationApi.create).not.toHaveBeenCalled();
    expect(container.textContent).toContain('less than 10MB');

    await unmount();
    container.remove();
  });

  test('successful submit calls calibrationApi.create with the equipment id, closes the modal, refreshes history, and shows success', async () => {
    const { container, unmount } = await renderDetail();
    const tabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Calibration ('));
    await act(async () => { tabBtn.click(); });
    openModal(container);

    const calDateInput = getModalInput(container, 'Calibration Date *');
    const expiryInput = getModalInput(container, 'Expiry Date *');
    act(() => { setInputValue(calDateInput, '15062026'); });
    act(() => { setInputValue(expiryInput, '15062027'); });
    const certNumberInput = getModalInput(container, 'Certificate Number');
    act(() => { setInputValue(certNumberInput, 'CAL-2026-999'); });

    calibrationApi.getHistory.mockResolvedValue({
      data: [{ id: 5, calibration_date: '2026-06-15', expiry_date: '2027-06-15', certificate_number: 'CAL-2026-999', created_at: '2026-06-15T00:00:00Z' }],
    });

    await act(async () => {
      const form = container.querySelector('form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(calibrationApi.create).toHaveBeenCalledTimes(1);
    const [payload] = calibrationApi.create.mock.calls[0];
    expect(payload.equipment_id).toBe(42);
    expect(payload.calibration_date).toBe('2026-06-15');
    expect(payload.expiry_date).toBe('2027-06-15');

    expect(container.querySelector('.modal')).toBeNull();
    expect(container.textContent).toContain('Calibration record added successfully!');
    expect(container.textContent).toContain('CAL-2026-999');

    await unmount();
    container.remove();
  });

  // Regression coverage for: clicking the dark overlay outside the Add
  // Calibration modal must NOT close it or lose entered form data.
  test('clicking the overlay does not close the modal or clear entered values', async () => {
    const { container, unmount } = await renderDetail();
    const tabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Calibration ('));
    await act(async () => { tabBtn.click(); });
    openModal(container);

    const certNumberInput = getModalInput(container, 'Certificate Number');
    act(() => { setInputValue(certNumberInput, 'CAL-KEEP-ME'); });

    const overlay = container.querySelector('.modal-overlay');
    act(() => { overlay.click(); });

    expect(container.querySelector('.modal')).toBeTruthy();
    expect(getModalInput(container, 'Certificate Number').value).toBe('CAL-KEEP-ME');

    await unmount();
    container.remove();
  });

  test('Cancel and × close the modal', async () => {
    const { container, unmount } = await renderDetail();
    const tabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Calibration ('));
    await act(async () => { tabBtn.click(); });
    openModal(container);

    const closeBtn = container.querySelector('.modal-close');
    act(() => { closeBtn.click(); });
    expect(container.querySelector('.modal')).toBeNull();

    openModal(container);
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
    act(() => { cancelBtn.click(); });
    expect(container.querySelector('.modal')).toBeNull();

    await unmount();
    container.remove();
  });
});
