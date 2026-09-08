// US states and Canadian provinces, the two countries whose subregion Frame
// validates as a code rather than accepting as free text. Ports iOS
// AddressSubregions (`Sources/Frame/Validation/AddressSubregions.swift`).

/** One accepted state / province / territory. */
export interface AddressSubregion {
  /** The two-letter code the API expects (e.g. `'CA'`). */
  code: string;
  /** The display name (e.g. `'California'`). */
  name: string;
}

/** The 50 states, DC, and the five inhabited territories. */
export const UNITED_STATES_SUBREGIONS: ReadonlyArray<AddressSubregion> = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'GU', name: 'Guam' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
];

/** The 10 provinces and 3 territories. */
export const CANADA_SUBREGIONS: ReadonlyArray<AddressSubregion> = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

const BY_COUNTRY: Readonly<Record<string, ReadonlyArray<AddressSubregion>>> = {
  US: UNITED_STATES_SUBREGIONS,
  CA: CANADA_SUBREGIONS,
};

/**
 * The subregions a country accepts, or null when its subregion is unvalidated
 * free text.
 *
 * An empty country string returns the US list rather than null — matching iOS,
 * whose forms default to the US before a country is picked.
 */
export function subregionsForCountry(
  alpha2: string,
): ReadonlyArray<AddressSubregion> | null {
  const trimmed = alpha2.trim();
  if (trimmed === '') return UNITED_STATES_SUBREGIONS;
  return BY_COUNTRY[trimmed.toUpperCase()] ?? null;
}

/** The accepted codes for a country, or null when the country is unvalidated. */
export function subregionCodesForCountry(alpha2: string): ReadonlySet<string> | null {
  const list = subregionsForCountry(alpha2);
  return list ? new Set(list.map((s) => s.code)) : null;
}

/** Looks up a subregion by code within a country's list. Case-insensitive. */
export function findSubregion(code: string, alpha2: string): AddressSubregion | null {
  const needle = code.trim().toUpperCase();
  return subregionsForCountry(alpha2)?.find((s) => s.code === needle) ?? null;
}

/**
 * Trims a subregion, upper-casing it only for countries whose subregions are
 * validated as codes — a free-text country keeps its casing.
 *
 * Call this before sending an address: without it, "california" goes to the API
 * as typed where iOS would send "CA".
 */
export function normalizeSubregion(value: string, alpha2: string): string {
  const trimmed = value.trim();
  return subregionsForCountry(alpha2) === null ? trimmed : trimmed.toUpperCase();
}
