import { normalizeProviderName, groupProvidersByNormalizedName, findSimilarProvider } from './calibrationProviders';

describe('normalizeProviderName', () => {
  test('lowercases, trims, and strips internal whitespace', () => {
    expect(normalizeProviderName('  WearCheck  ')).toBe('wearcheck');
    expect(normalizeProviderName('WEARCHECK')).toBe('wearcheck');
    expect(normalizeProviderName('wear   check')).toBe('wearcheck');
    expect(normalizeProviderName('wear check')).toBe('wearcheck');
  });

  test('returns an empty string for null/undefined/blank input', () => {
    expect(normalizeProviderName(null)).toBe('');
    expect(normalizeProviderName(undefined)).toBe('');
    expect(normalizeProviderName('   ')).toBe('');
  });
});

describe('groupProvidersByNormalizedName', () => {
  test('groups case/whitespace variants of the same provider together', () => {
    const providers = [
      { name: 'WearCheck', count: 12 },
      { name: 'Wearcheck', count: 3 },
      { name: 'WEARCHECK', count: 1 },
      { name: 'wear check', count: 2 },
      { name: 'Acme Labs', count: 5 },
    ];
    const groups = groupProvidersByNormalizedName(providers);
    expect(groups).toHaveLength(2);

    const wearcheckGroup = groups.find((g) => g.key === 'wearcheck');
    expect(wearcheckGroup.hasDuplicates).toBe(true);
    expect(wearcheckGroup.totalCount).toBe(18);
    // Sorted by count desc -- the most-used spelling comes first as the suggested canonical.
    expect(wearcheckGroup.variants.map((v) => v.name)).toEqual(['WearCheck', 'Wearcheck', 'wear check', 'WEARCHECK']);

    const acmeGroup = groups.find((g) => g.key === 'acmelabs');
    expect(acmeGroup.hasDuplicates).toBe(false);
    expect(acmeGroup.totalCount).toBe(5);
  });

  test('sorts groups by total usage count descending', () => {
    const providers = [
      { name: 'Small Lab', count: 1 },
      { name: 'Big Lab', count: 20 },
    ];
    const groups = groupProvidersByNormalizedName(providers);
    expect(groups.map((g) => g.key)).toEqual(['biglab', 'smalllab']);
  });

  test('ignores blank/whitespace-only names and returns an empty array for no input', () => {
    expect(groupProvidersByNormalizedName([{ name: '   ', count: 1 }])).toEqual([]);
    expect(groupProvidersByNormalizedName([])).toEqual([]);
    expect(groupProvidersByNormalizedName(null)).toEqual([]);
  });
});

describe('findSimilarProvider', () => {
  const existing = ['WearCheck', 'Acme Labs'];

  test('suggests an existing spelling that normalizes the same but differs exactly', () => {
    expect(findSimilarProvider('wearcheck', existing)).toBe('WearCheck');
    expect(findSimilarProvider('WEARCHECK', existing)).toBe('WearCheck');
    expect(findSimilarProvider('wear check', existing)).toBe('WearCheck');
  });

  test('returns null when the typed value already matches an existing spelling exactly', () => {
    expect(findSimilarProvider('WearCheck', existing)).toBeNull();
  });

  test('returns null for a genuinely new provider name', () => {
    expect(findSimilarProvider('Brand New Calibrators', existing)).toBeNull();
  });

  test('returns null for blank input', () => {
    expect(findSimilarProvider('', existing)).toBeNull();
    expect(findSimilarProvider('   ', existing)).toBeNull();
    expect(findSimilarProvider(null, existing)).toBeNull();
  });
});
