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
