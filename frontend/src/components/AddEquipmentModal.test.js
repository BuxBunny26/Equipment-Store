import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import AddEquipmentModal from './AddEquipmentModal';
import {
  equipmentApi, categoriesApi, locationsApi, subcategoriesApi, customersApi, personnelApi, movementsApi,
} from '../services/api';

global.IS_REACT_ACT_ENVIRONMENT = true;

// Regression coverage for: AMS2140 "Number of Channels" must appear/require
// a selection when Model identifies a 2140 analyser, must NOT appear for
// other models, and must never carry a stale value across a Model change.
// NOTE: CRA's default Jest config sets `resetMocks: true`, which strips any
// mockImplementation (even one baked in at jest.fn(impl) creation time)
// before EVERY test. So implementations are (re-)applied in beforeEach
// below, not just once here at module-factory time.
jest.mock('../services/api', () => ({
  categoriesApi: { getAll: jest.fn() },
  subcategoriesApi: { getAll: jest.fn() },
  locationsApi: { getAll: jest.fn() },
  customersApi: { getAll: jest.fn() },
  personnelApi: { getAll: jest.fn() },
  equipmentApi: {
    getIdsByPrefix: jest.fn(),
    checkSerial: jest.fn(),
    checkEquipmentIdExists: jest.fn(),
    create: jest.fn(),
  },
  movementsApi: { create: jest.fn() },
}));

jest.mock('../context/OperatorContext', () => ({
  useOperator: () => ({ operator: { id: 1, full_name: 'Test Manager' }, operatorRole: 'manager' }),
}));

function setInputValue(element, value) {
  const proto = Object.getPrototypeOf(element);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function setSelectValue(select, value) {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function getChannelsSelect(container) {
  return Array.from(container.querySelectorAll('select')).find(sel =>
    Array.from(sel.options).some(o => o.textContent.toLowerCase().includes('select number of channels'))
  ) || null;
}

async function renderModal() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<AddEquipmentModal onClose={() => {}} onSuccess={() => {}} />);
  });
  // Flush the mount-time categories/locations/customers/personnel fetches
  // (chained supabase-mock promises) before tests interact with the form.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return {
    container,
    unmount: () => act(async () => root.unmount()),
  };
}

// Fills every field required for a valid submission EXCEPT Model/Channels,
// which each test sets itself.
async function fillBaseRequiredFields(container) {
  await act(async () => {
    setInputValue(container.querySelector('input[name="equipment_id"]'), 'EQ-TEST-0001');
  });
  await act(async () => {
    setInputValue(container.querySelector('input[name="equipment_name"]'), 'Test Equipment');
  });
  await act(async () => {
    setSelectValue(container.querySelector('select[name="category_id"]'), '1');
  });
  await act(async () => {
    setSelectValue(container.querySelector('select[name="subcategory_id"]'), '11');
  });
  await act(async () => {
    setInputValue(container.querySelector('input[name="manufacturer"]'), 'Emerson');
  });
  await act(async () => {
    setInputValue(container.querySelector('input[name="serial_number"]'), 'SN-0001');
  });
  // Select the internal "WearCheck HQ" location checkbox.
  const locationLabel = Array.from(container.querySelectorAll('label')).find(l => l.textContent.includes('WearCheck HQ'));
  const locationCheckbox = locationLabel.querySelector('input[type="checkbox"]');
  await act(async () => {
    locationCheckbox.click();
  });
}

describe('AddEquipmentModal — AMS2140 Number of Channels', () => {
  beforeEach(() => {
    // Re-apply mock implementations every test: CRA's `resetMocks: true`
    // strips them automatically before each test runs.
    categoriesApi.getAll.mockResolvedValue({ data: [{ id: 1, name: 'Vibration', is_consumable: false, is_checkout_allowed: true }] });
    subcategoriesApi.getAll.mockResolvedValue({ data: [{ id: 11, name: 'Analysers' }] });
    locationsApi.getAll.mockResolvedValue({ data: [{ id: 21, name: 'WearCheck HQ' }] });
    customersApi.getAll.mockResolvedValue({ data: [] });
    personnelApi.getAll.mockResolvedValue({ data: [] });
    equipmentApi.getIdsByPrefix.mockResolvedValue({ data: [] });
    equipmentApi.checkSerial.mockResolvedValue({ data: [] });
    equipmentApi.checkEquipmentIdExists.mockResolvedValue({ data: [] });
    equipmentApi.create.mockResolvedValue({ data: { id: 999 } });
    movementsApi.create.mockResolvedValue({ data: {} });
  });

  test('does not show Number of Channels for a non-2140 model', async () => {
    const { container, unmount } = await renderModal();
    await act(async () => {
      setInputValue(container.querySelector('input[name="model"]'), 'CMXA 80');
    });
    expect(getChannelsSelect(container)).toBeNull();
    await unmount();
    container.remove();
  });

  test.each([
    ['2140'],
    ['AMS 2140'],
    ['AMS2140'],
    ['Emerson AMS 2140'],
  ])('shows a required Number of Channels select for model="%s"', async (model) => {
    const { container, unmount } = await renderModal();
    await act(async () => {
      setInputValue(container.querySelector('input[name="model"]'), model);
    });
    const select = getChannelsSelect(container);
    expect(select).not.toBeNull();
    expect(select.required).toBe(true);
    expect(select.value).toBe('');
    await unmount();
    container.remove();
  });

  test('changing Model from a 2140 to a non-2140 hides the field and clears its value (not carried over)', async () => {
    const { container, unmount } = await renderModal();
    await act(async () => {
      setInputValue(container.querySelector('input[name="model"]'), 'AMS 2140');
    });
    let select = getChannelsSelect(container);
    await act(async () => {
      setSelectValue(select, '4 Channel');
    });
    expect(getChannelsSelect(container).value).toBe('4 Channel');

    await act(async () => {
      setInputValue(container.querySelector('input[name="model"]'), 'CMXA 80');
    });
    expect(getChannelsSelect(container)).toBeNull();

    // Switching back to a 2140 model must show a blank selection again, not
    // the previously-chosen "4 Channel".
    await act(async () => {
      setInputValue(container.querySelector('input[name="model"]'), 'AMS 2140');
    });
    expect(getChannelsSelect(container).value).toBe('');

    await unmount();
    container.remove();
  });

  test('submits custom_fields.channels for a recognised 2140 with a channel selected', async () => {
    const { container, unmount } = await renderModal();
    await fillBaseRequiredFields(container);
    await act(async () => {
      setInputValue(container.querySelector('input[name="model"]'), 'AMS 2140');
    });
    await act(async () => {
      setSelectValue(getChannelsSelect(container), '2 Channel');
    });

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(equipmentApi.create).toHaveBeenCalledTimes(1);
    expect(equipmentApi.create.mock.calls[0][0].custom_fields).toEqual({ channels: '2 Channel' });
    await unmount();
    container.remove();
  });

  test('does not submit a channels custom field for a non-2140 model', async () => {
    const { container, unmount } = await renderModal();
    await fillBaseRequiredFields(container);
    await act(async () => {
      setInputValue(container.querySelector('input[name="model"]'), 'CMXA 80');
    });

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(equipmentApi.create).toHaveBeenCalledTimes(1);
    expect(equipmentApi.create.mock.calls[0][0].custom_fields).toBeUndefined();
    await unmount();
    container.remove();
  });
});
