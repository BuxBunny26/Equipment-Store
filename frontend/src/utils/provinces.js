// Canonical South African province names + alias map used to dedupe and
// standardise customer billing_state values across the UI.
//
// Even after the DB migration (`backend/database/normalize_provinces.sql`),
// this keeps the dropdowns clean if a new row is imported with a variant
// spelling or a city name in the state column.

export const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
];

const SA_PROVINCE_SET = new Set(SA_PROVINCES);

const SA_SUBURB_TO_PROVINCE = {
  marshalltown: 'Gauteng',
  'tulisa park': 'Gauteng',
  'kriel rd kriel colliery': 'Mpumalanga',
};

const ALIASES = {
  'kwazulu-natal': 'KwaZulu-Natal',
  'kwazulu natal': 'KwaZulu-Natal',
  kzn: 'KwaZulu-Natal',
  'north-west': 'North West',
  northwest: 'North West',
  'north west': 'North West',
  gauteng: 'Gauteng',
  gp: 'Gauteng',
  mpumalanga: 'Mpumalanga',
  mp: 'Mpumalanga',
  limpopo: 'Limpopo',
  lp: 'Limpopo',
  'free state': 'Free State',
  freestate: 'Free State',
  'eastern cape': 'Eastern Cape',
  'western cape': 'Western Cape',
  'northern cape': 'Northern Cape',
};

const COUNTRY_ALIASES = {
  'democratic republic of congo': 'DRC',
  'democratic republic of the congo': 'DRC',
  drc: 'DRC',
  rsa: 'South Africa',
  'south africa': 'South Africa',
  uk: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  usa: 'United States',
  'united states': 'United States',
};

/**
 * Normalise a single billing_state value to its canonical form.
 * Returns null for empty/missing values.
 */
export function normalizeProvince(raw, country) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  if (
    SA_SUBURB_TO_PROVINCE[key] &&
    (!country || String(country).toLowerCase().includes('south africa'))
  ) {
    return SA_SUBURB_TO_PROVINCE[key];
  }
  return trimmed;
}

/** Normalise a country name to a canonical short form (e.g. "DRC"). */
export function normalizeCountry(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  return COUNTRY_ALIASES[key] || trimmed;
}

/** Returns true when the normalised value is a South African province. */
export function isSouthAfricanProvince(province) {
  return !!province && SA_PROVINCE_SET.has(province);
}

/**
 * Sorted, deduped list of SA provinces present in the customer list.
 * Foreign regions are excluded — use `uniqueCountries` for those.
 */
export function uniqueProvinces(customers) {
  const set = new Set();
  for (const c of customers) {
    const p = normalizeProvince(c.billing_state, c.billing_country);
    if (isSouthAfricanProvince(p)) set.add(p);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Sorted, deduped list of canonical country names present in the customer list. */
export function uniqueCountries(customers) {
  const set = new Set();
  for (const c of customers) {
    const country = normalizeCountry(c.billing_country);
    if (country) set.add(country);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function customerMatchesProvince(customer, province) {
  if (!province) return true;
  return normalizeProvince(customer.billing_state, customer.billing_country) === province;
}

export function customerMatchesCountry(customer, country) {
  if (!country) return true;
  return normalizeCountry(customer.billing_country) === country;
}

/**
 * Returns the best regional label for display next to a customer name:
 *   - SA: the normalised province (or city fallback)
 *   - Other: the canonical country name
 */
export function regionLabel(customer) {
  const country = normalizeCountry(customer.billing_country);
  if (country === 'South Africa') {
    const province = normalizeProvince(customer.billing_state, customer.billing_country);
    return province || customer.billing_city || null;
  }
  return country || normalizeProvince(customer.billing_state, customer.billing_country);
}
