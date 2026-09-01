import {
  DEFAULT_EQUIPMENT_FILTERS,
  filtersToSearchParams,
  searchParamsToFilters,
} from './equipmentListState';

describe('equipmentListState pure logic', () => {
  test('default (empty) search params decode to the default filter shape', () => {
    expect(searchParamsToFilters(new URLSearchParams(''))).toEqual(DEFAULT_EQUIPMENT_FILTERS);
  });

  test('default filters encode to an empty search string', () => {
    expect(filtersToSearchParams(DEFAULT_EQUIPMENT_FILTERS).toString()).toBe('');
  });

  test('search round-trips as free text', () => {
    const filters = { ...DEFAULT_EQUIPMENT_FILTERS, search: 'fluke' };
    const params = filtersToSearchParams(filters);
    expect(params.get('search')).toBe('fluke');
    expect(searchParamsToFilters(params).search).toBe('fluke');
  });

  test('a valid category id round-trips', () => {
    const filters = { ...DEFAULT_EQUIPMENT_FILTERS, category_id: '2' };
    const params = filtersToSearchParams(filters);
    expect(params.get('category')).toBe('2');
    expect(searchParamsToFilters(params).category_id).toBe('2');
  });

  test('a non-numeric category id is ignored, falling back to the default', () => {
    const params = new URLSearchParams('category=abc');
    expect(searchParamsToFilters(params).category_id).toBe('');
  });

  test('a valid status round-trips', () => {
    const filters = { ...DEFAULT_EQUIPMENT_FILTERS, status: 'Checked Out' };
    const params = filtersToSearchParams(filters);
    expect(searchParamsToFilters(params).status).toBe('Checked Out');
  });

  test('an invalid/stale status value is ignored, falling back to the default', () => {
    const params = new URLSearchParams('status=NotARealStatus');
    expect(searchParamsToFilters(params).status).toBe('');
  });

  test('a valid calibration status round-trips', () => {
    const filters = { ...DEFAULT_EQUIPMENT_FILTERS, calibration_status: 'Due Soon' };
    const params = filtersToSearchParams(filters);
    expect(searchParamsToFilters(params).calibration_status).toBe('Due Soon');
  });

  test('an invalid calibration status value is ignored', () => {
    const params = new URLSearchParams('calibration=Bogus');
    expect(searchParamsToFilters(params).calibration_status).toBe('');
  });

  test('a valid channels value round-trips', () => {
    const filters = { ...DEFAULT_EQUIPMENT_FILTERS, channels: '4 Channel' };
    const params = filtersToSearchParams(filters);
    expect(params.get('channels')).toBe('4 Channel');
    expect(searchParamsToFilters(params).channels).toBe('4 Channel');
  });

  test('an invalid channels value is ignored', () => {
    const params = new URLSearchParams('channels=99');
    expect(searchParamsToFilters(params).channels).toBe('');
  });

  test('is_consumable=true round-trips; anything else falls back to the default (false)', () => {
    const trueParams = filtersToSearchParams({ ...DEFAULT_EQUIPMENT_FILTERS, is_consumable: 'true' });
    expect(searchParamsToFilters(trueParams).is_consumable).toBe('true');
    expect(searchParamsToFilters(new URLSearchParams('consumable=nonsense')).is_consumable).toBe('false');
  });

  test('multiple simultaneous filters encode and decode together without interference', () => {
    const filters = {
      search: 'fluke', status: 'Available', category_id: '2',
      is_consumable: 'false', calibration_status: 'Due Soon', channels: '4 Channel',
    };
    const params = filtersToSearchParams(filters);
    expect(searchParamsToFilters(params)).toEqual(filters);
  });

  test('invalid values across multiple params at once do not crash and each falls back independently', () => {
    const params = new URLSearchParams('status=Bogus&category=xyz&calibration=Nope&channels=7&consumable=maybe');
    expect(() => searchParamsToFilters(params)).not.toThrow();
    expect(searchParamsToFilters(params)).toEqual(DEFAULT_EQUIPMENT_FILTERS);
  });
});
