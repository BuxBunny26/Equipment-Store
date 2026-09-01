import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Calibration from './Calibration';
import { calibrationApi, categoriesApi } from '../services/api';

global.IS_REACT_ACT_ENVIRONMENT = true;

// Regression coverage for: Dashboard status cards linking to
// /calibration?status=<X> must preselect that status in the filter
// dropdown AND request it from the API, instead of showing the
// unfiltered (effectively "all statuses, dominated by Expired") list.
jest.mock('../services/api', () => ({
  calibrationApi: {
    getStatus: jest.fn(() => Promise.resolve({ data: [] })),
    getSummary: jest.fn(() => Promise.resolve({ data: { summary: [], total: 0 } })),
    create: jest.fn(),
  },
  categoriesApi: {
    getAll: jest.fn(() => Promise.resolve({ data: [] })),
  },
}));

async function renderAtPath(path) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Calibration />
      </MemoryRouter>
    );
  });
  return { container, unmount: () => act(async () => root.unmount()) };
}

// Navigates within the SAME already-mounted Calibration instance (unlike
// renderAtPath, which mounts fresh at a given path) — reproduces a route
// matching on path alone, so this is the only way to exercise "component
// stays mounted while the URL's status query param changes".
let navigateRef;
function NavigateProbe() {
  navigateRef = useNavigate();
  return null;
}

async function renderWithNavigation(path) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <NavigateProbe />
        <Calibration />
      </MemoryRouter>
    );
  });
  return {
    container,
    navigateTo: (nextPath) => act(async () => navigateRef(nextPath)),
    unmount: () => act(async () => root.unmount()),
  };
}

describe('Calibration dashboard status-filter navigation', () => {
  beforeEach(() => {
    calibrationApi.getStatus.mockClear();
    calibrationApi.getSummary.mockClear();
    categoriesApi.getAll.mockClear();
  });

  test.each([
    ['Valid'],
    ['Due Soon'],
    ['Expired'],
    ['Not Calibrated'],
  ])('navigating with ?status=%s preselects that status and queries it', async (status) => {
    const { container, unmount } = await renderAtPath(`/calibration?status=${encodeURIComponent(status)}`);

    const statusSelect = container.querySelectorAll('select')[0];
    expect(statusSelect.value).toBe(status);
    expect(calibrationApi.getStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status })
    );

    await unmount();
    container.remove();
  });

  test('navigating without a status query param requests all statuses', async () => {
    const { container, unmount } = await renderAtPath('/calibration');

    const statusSelect = container.querySelectorAll('select')[0];
    expect(statusSelect.value).toBe('');
    expect(calibrationApi.getStatus).toHaveBeenCalledWith({});

    await unmount();
    container.remove();
  });

  // Path-only route matching (see App.js) does not remount Calibration when
  // only the query string changes, so this covers the useSearchParams sync
  // effect rather than the useState initializer covered above.
  test('status query param change while already mounted updates the filter', async () => {
    const { container, navigateTo, unmount } = await renderWithNavigation('/calibration?status=Valid');

    let statusSelect = container.querySelectorAll('select')[0];
    expect(statusSelect.value).toBe('Valid');

    await navigateTo('/calibration?status=Expired');
    statusSelect = container.querySelectorAll('select')[0];
    expect(statusSelect.value).toBe('Expired');
    expect(calibrationApi.getStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Expired' })
    );

    await navigateTo('/calibration');
    statusSelect = container.querySelectorAll('select')[0];
    expect(statusSelect.value).toBe('');
    expect(calibrationApi.getStatus).toHaveBeenLastCalledWith({});

    await unmount();
    container.remove();
  });

  test('manual dropdown selection is not overwritten by the URL-sync effect', async () => {
    const { container, unmount } = await renderAtPath('/calibration?status=Valid');

    const statusSelect = container.querySelectorAll('select')[0];
    await act(async () => {
      statusSelect.value = 'Expired';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(statusSelect.value).toBe('Expired');
    expect(calibrationApi.getStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'Expired' })
    );

    await unmount();
    container.remove();
  });
});
// Regression coverage for two Add Calibration modal UX bugs:
// 1. Clicking the dark overlay outside the modal must NOT close it or lose
//    entered form data (it previously called setShowAddModal(false)).
// 2. Add Calibration validation/API errors must render INSIDE the modal
//    (calibrationFormError), not in the page-level banner behind it (error).
const testEquipment = {
  equipment_id: 42,
  equipment_code: 'EQ-TEST-0042',
  equipment_name: 'Test Analyser',
  category: 'Analysers',
  serial_number: 'SN-1234',
  manufacturer: 'Emerson',
  last_calibration_date: null,
  calibration_expiry_date: null,
  days_until_expiry: null,
  calibration_status: 'Not Calibrated',
  certificate_file_url: null,
};

function setInputValue(element, value) {
  const proto = Object.getPrototypeOf(element);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function openAddModal(container) {
  const btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === '+ Calibrate');
  act(() => { btn.click(); });
}

function getModalInput(container, labelText) {
  const label = Array.from(container.querySelectorAll('label')).find(l => l.textContent.trim() === labelText);
  return label.parentElement.querySelector('input, textarea');
}

describe('Calibration Add Calibration modal UX', () => {
  beforeEach(() => {
    calibrationApi.getStatus.mockReset().mockResolvedValue({ data: [{ ...testEquipment }] });
    calibrationApi.getSummary.mockReset().mockResolvedValue({ data: { summary: [], total: 0 } });
    calibrationApi.create.mockReset().mockResolvedValue({ data: { id: 999 } });
    categoriesApi.getAll.mockReset().mockResolvedValue({ data: [] });
  });

  test('clicking the overlay does not close the modal or clear entered values', async () => {
    const { container, unmount } = await renderAtPath('/calibration');
    openAddModal(container);

    const certNumberInput = getModalInput(container, 'Certificate Number');
    act(() => { setInputValue(certNumberInput, 'CAL-KEEP-ME'); });

    const overlay = container.querySelector('.modal-overlay');
    act(() => { overlay.click(); });

    expect(container.querySelector('.modal')).toBeTruthy();
    expect(getModalInput(container, 'Certificate Number').value).toBe('CAL-KEEP-ME');

    await unmount();
    container.remove();
  });

  test('clicking inside the modal does not close it', async () => {
    const { container, unmount } = await renderAtPath('/calibration');
    openAddModal(container);

    const modal = container.querySelector('.modal');
    act(() => { modal.click(); });

    expect(container.querySelector('.modal')).toBeTruthy();

    await unmount();
    container.remove();
  });

  test('Cancel button closes the modal', async () => {
    const { container, unmount } = await renderAtPath('/calibration');
    openAddModal(container);

    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
    act(() => { cancelBtn.click(); });

    expect(container.querySelector('.modal')).toBeNull();

    await unmount();
    container.remove();
  });

  test('× button closes the modal', async () => {
    const { container, unmount } = await renderAtPath('/calibration');
    openAddModal(container);

    const closeBtn = container.querySelector('.modal-close');
    act(() => { closeBtn.click(); });

    expect(container.querySelector('.modal')).toBeNull();

    await unmount();
    container.remove();
  });

  test('invalid calibration date shows error inside the modal, not the page banner', async () => {
    const { container, unmount } = await renderAtPath('/calibration');
    openAddModal(container);

    const calDateInput = getModalInput(container, 'Calibration Date *');
    const expiryInput = getModalInput(container, 'Expiry Date *');
    act(() => { setInputValue(calDateInput, '31042026'); });
    act(() => { setInputValue(expiryInput, '31122027'); });

    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Save Calibration Record');
    act(() => { saveBtn.click(); });

    const modal = container.querySelector('.modal');
    expect(modal.textContent).toContain('valid date');
    const alertsOutsideModal = Array.from(container.querySelectorAll('.alert-error'))
      .filter((el) => !modal.contains(el));
    expect(alertsOutsideModal.some((el) => el.textContent.includes('valid date'))).toBe(false);

    await unmount();
    container.remove();
  });

  test('expiry-before-calibration error shows inside the modal', async () => {
    const { container, unmount } = await renderAtPath('/calibration');
    openAddModal(container);

    const calDateInput = getModalInput(container, 'Calibration Date *');
    const expiryInput = getModalInput(container, 'Expiry Date *');
    act(() => { setInputValue(calDateInput, '15062026'); });
    act(() => { setInputValue(expiryInput, '01012026'); });

    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Save Calibration Record');
    act(() => { saveBtn.click(); });

    const modal = container.querySelector('.modal');
    expect(modal.textContent).toContain('cannot be before');

    await unmount();
    container.remove();
  });

  test('oversized certificate file error shows inside the modal', async () => {
    const { container, unmount } = await renderAtPath('/calibration');
    openAddModal(container);

    const calDateInput = getModalInput(container, 'Calibration Date *');
    const expiryInput = getModalInput(container, 'Expiry Date *');
    act(() => { setInputValue(calDateInput, '15062026'); });
    act(() => { setInputValue(expiryInput, '15062027'); });

    const fileInput = container.querySelector('input[type="file"]');
    const bigFile = new File(['x'.repeat(10)], 'cert.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });
    Object.defineProperty(fileInput, 'files', { value: [bigFile] });
    act(() => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });

    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Save Calibration Record');
    act(() => { saveBtn.click(); });

    const modal = container.querySelector('.modal');
    expect(modal.textContent).toContain('less than 10MB');

    await unmount();
    container.remove();
  });

  test('calibrationApi.create failure shows inside the modal', async () => {
    calibrationApi.create.mockRejectedValue(new Error('Network error'));
    const { container, unmount } = await renderAtPath('/calibration');
    openAddModal(container);

    const calDateInput = getModalInput(container, 'Calibration Date *');
    const expiryInput = getModalInput(container, 'Expiry Date *');
    act(() => { setInputValue(calDateInput, '15062026'); });
    act(() => { setInputValue(expiryInput, '15062027'); });

    await act(async () => {
      const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Save Calibration Record');
      saveBtn.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const modal = container.querySelector('.modal');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Error adding calibration');

    await unmount();
    container.remove();
  });

  test('successful submit closes the modal and preserves success behaviour', async () => {
    const { container, unmount } = await renderAtPath('/calibration');
    openAddModal(container);

    const calDateInput = getModalInput(container, 'Calibration Date *');
    const expiryInput = getModalInput(container, 'Expiry Date *');
    act(() => { setInputValue(calDateInput, '15062026'); });
    act(() => { setInputValue(expiryInput, '15062027'); });

    await act(async () => {
      const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Save Calibration Record');
      saveBtn.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(calibrationApi.create).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.modal')).toBeNull();
    expect(container.textContent).toContain('Calibration record added successfully!');

    await unmount();
    container.remove();
  });
});
