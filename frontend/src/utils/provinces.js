// Canonical province / region names + alias map used to dedupe and
// standardise customer billing_state values across the UI.
//
// Even after the DB migration (`backend/database/normalize_provinces.sql`),
// this keeps the dropdowns clean if a new row is imported with a variant
// spelling or a city name in the state column.

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

/**
 * Normalise a single billing_state value to its canonical form.
 * Returns null for empty/missing values.
 *
 * @param {string|null|undefined} raw
 * @param {string|null|undefined} country - optional, used to map SA suburbs to province
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

/**
 * Build a sorted, deduped list of canonical province names from a
 * list of customer records (objects with billing_state / billing_country).
 *
 * @param {Array<{billing_state?: string, billing_country?: string}>} customers
 * @returns {string[]}
 */
export function uniqueProvinces(customers) {
  const set = new Set();
  for (const c of customers) {
    const p = normalizeProvince(c.billing_state, c.billing_country);
    if (p) set.add(p);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Returns true when a customer record matches the selected (canonical) province.
 *
 * @param {{billing_state?: string, billing_country?: string}} customer
 * @param {string} province - canonical province name (output of normalizeProvince)
 */
export function customerMatchesProvince(customer, province) {
  if (!province) return true;
  return normalizeProvince(customer.billing_state, customer.billing_country) === province;
}
