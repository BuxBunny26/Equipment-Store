// Encodes/decodes the Equipment List's filter state to/from URL search
// params, so the list can be restored exactly when a user navigates
// List -> Detail -> Back (browser Back or the Detail page's own Back button,
// both of which are plain history navigation and therefore land back on the
// same URL). Single source of truth for the filter shape so it never drifts
// out of sync between the initial state, Clear Filters, and URL encoding.
export const DEFAULT_EQUIPMENT_FILTERS = {
  search: '',
  status: '',
  category_id: '',
  is_consumable: 'false',
  calibration_status: '',
  channels: '',
};

const VALID_STATUS = ['Available', 'Checked Out'];
const VALID_CALIBRATION_STATUS = ['Calibrated', 'Due Soon', 'Expired', 'Not Calibrated'];
const VALID_CHANNELS = ['1 Channel', '2 Channel', '4 Channel'];

// Only meaningful (non-default) values are written, so a fully-cleared
// filter set produces a bare `/equipment` URL rather than a noisy one.
export function filtersToSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.category_id) params.set('category', filters.category_id);
  if (filters.is_consumable && filters.is_consumable !== DEFAULT_EQUIPMENT_FILTERS.is_consumable) {
    params.set('consumable', filters.is_consumable);
  }
  if (filters.calibration_status) params.set('calibration', filters.calibration_status);
  if (filters.channels) params.set('channels', filters.channels);
  return params;
}

// Invalid/stale values (e.g. a since-removed calibration status, or a
// non-numeric category) are silently dropped in favour of the default rather
// than crashing or being sent to the API.
export function searchParamsToFilters(searchParams) {
  const status = searchParams.get('status') || '';
  const category = searchParams.get('category') || '';
  const consumable = searchParams.get('consumable') || '';
  const calibration = searchParams.get('calibration') || '';
  const channels = searchParams.get('channels') || '';

  return {
    search: searchParams.get('search') || '',
    status: VALID_STATUS.includes(status) ? status : '',
    category_id: /^\d+$/.test(category) ? category : '',
    is_consumable: consumable === 'true' ? 'true' : DEFAULT_EQUIPMENT_FILTERS.is_consumable,
    calibration_status: VALID_CALIBRATION_STATUS.includes(calibration) ? calibration : '',
    channels: VALID_CHANNELS.includes(channels) ? channels : '',
  };
}
