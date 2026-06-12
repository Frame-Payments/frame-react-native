import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

// Frozen ISO 3166-1 alpha-2 → English display-name table. Generated once from
// Node's Intl.DisplayNames and shipped in-repo so the SDK doesn't rely on
// Hermes ICU (which lacks Intl.DisplayNames on RN), and so sanctions-screening
// can't be bypassed by runtime CLDR rename drift.
//
// Exceptional reservations (AC, CP, DG, EA, EU, EZ, IC, TA, XK) are deliberately
// excluded — they're not ISO 3166-1 alpha-2 codes.
const COUNTRIES: ReadonlyArray<readonly [string, string]> = [
  ['AF', 'Afghanistan'],
  ['AX', 'Åland Islands'],
  ['AL', 'Albania'],
  ['DZ', 'Algeria'],
  ['AS', 'American Samoa'],
  ['AD', 'Andorra'],
  ['AO', 'Angola'],
  ['AI', 'Anguilla'],
  ['AQ', 'Antarctica'],
  ['AG', 'Antigua & Barbuda'],
  ['AR', 'Argentina'],
  ['AM', 'Armenia'],
  ['AW', 'Aruba'],
  ['AU', 'Australia'],
  ['AT', 'Austria'],
  ['AZ', 'Azerbaijan'],
  ['BS', 'Bahamas'],
  ['BH', 'Bahrain'],
  ['BD', 'Bangladesh'],
  ['BB', 'Barbados'],
  ['BY', 'Belarus'],
  ['BE', 'Belgium'],
  ['BZ', 'Belize'],
  ['BJ', 'Benin'],
  ['BM', 'Bermuda'],
  ['BT', 'Bhutan'],
  ['BO', 'Bolivia'],
  ['BA', 'Bosnia & Herzegovina'],
  ['BW', 'Botswana'],
  ['BV', 'Bouvet Island'],
  ['BR', 'Brazil'],
  ['IO', 'British Indian Ocean Territory'],
  ['VG', 'British Virgin Islands'],
  ['BN', 'Brunei'],
  ['BG', 'Bulgaria'],
  ['BF', 'Burkina Faso'],
  ['BI', 'Burundi'],
  ['KH', 'Cambodia'],
  ['CM', 'Cameroon'],
  ['CA', 'Canada'],
  ['CV', 'Cape Verde'],
  ['BQ', 'Caribbean Netherlands'],
  ['KY', 'Cayman Islands'],
  ['CF', 'Central African Republic'],
  ['TD', 'Chad'],
  ['CL', 'Chile'],
  ['CN', 'China'],
  ['CX', 'Christmas Island'],
  ['CC', 'Cocos (Keeling) Islands'],
  ['CO', 'Colombia'],
  ['KM', 'Comoros'],
  ['CG', 'Congo - Brazzaville'],
  ['CD', 'Congo - Kinshasa'],
  ['CK', 'Cook Islands'],
  ['CR', 'Costa Rica'],
  ['CI', 'Côte d’Ivoire'],
  ['HR', 'Croatia'],
  ['CU', 'Cuba'],
  ['CW', 'Curaçao'],
  ['CY', 'Cyprus'],
  ['CZ', 'Czechia'],
  ['DK', 'Denmark'],
  ['DJ', 'Djibouti'],
  ['DM', 'Dominica'],
  ['DO', 'Dominican Republic'],
  ['EC', 'Ecuador'],
  ['EG', 'Egypt'],
  ['SV', 'El Salvador'],
  ['GQ', 'Equatorial Guinea'],
  ['ER', 'Eritrea'],
  ['EE', 'Estonia'],
  ['SZ', 'Eswatini'],
  ['ET', 'Ethiopia'],
  ['FK', 'Falkland Islands'],
  ['FO', 'Faroe Islands'],
  ['FJ', 'Fiji'],
  ['FI', 'Finland'],
  ['FR', 'France'],
  ['GF', 'French Guiana'],
  ['PF', 'French Polynesia'],
  ['TF', 'French Southern Territories'],
  ['GA', 'Gabon'],
  ['GM', 'Gambia'],
  ['GE', 'Georgia'],
  ['DE', 'Germany'],
  ['GH', 'Ghana'],
  ['GI', 'Gibraltar'],
  ['GR', 'Greece'],
  ['GL', 'Greenland'],
  ['GD', 'Grenada'],
  ['GP', 'Guadeloupe'],
  ['GU', 'Guam'],
  ['GT', 'Guatemala'],
  ['GG', 'Guernsey'],
  ['GN', 'Guinea'],
  ['GW', 'Guinea-Bissau'],
  ['GY', 'Guyana'],
  ['HT', 'Haiti'],
  ['HM', 'Heard & McDonald Islands'],
  ['HN', 'Honduras'],
  ['HK', 'Hong Kong SAR China'],
  ['HU', 'Hungary'],
  ['IS', 'Iceland'],
  ['IN', 'India'],
  ['ID', 'Indonesia'],
  ['IR', 'Iran'],
  ['IQ', 'Iraq'],
  ['IE', 'Ireland'],
  ['IM', 'Isle of Man'],
  ['IL', 'Israel'],
  ['IT', 'Italy'],
  ['JM', 'Jamaica'],
  ['JP', 'Japan'],
  ['JE', 'Jersey'],
  ['JO', 'Jordan'],
  ['KZ', 'Kazakhstan'],
  ['KE', 'Kenya'],
  ['KI', 'Kiribati'],
  ['KW', 'Kuwait'],
  ['KG', 'Kyrgyzstan'],
  ['LA', 'Laos'],
  ['LV', 'Latvia'],
  ['LB', 'Lebanon'],
  ['LS', 'Lesotho'],
  ['LR', 'Liberia'],
  ['LY', 'Libya'],
  ['LI', 'Liechtenstein'],
  ['LT', 'Lithuania'],
  ['LU', 'Luxembourg'],
  ['MO', 'Macao SAR China'],
  ['MG', 'Madagascar'],
  ['MW', 'Malawi'],
  ['MY', 'Malaysia'],
  ['MV', 'Maldives'],
  ['ML', 'Mali'],
  ['MT', 'Malta'],
  ['MH', 'Marshall Islands'],
  ['MQ', 'Martinique'],
  ['MR', 'Mauritania'],
  ['MU', 'Mauritius'],
  ['YT', 'Mayotte'],
  ['MX', 'Mexico'],
  ['FM', 'Micronesia'],
  ['MD', 'Moldova'],
  ['MC', 'Monaco'],
  ['MN', 'Mongolia'],
  ['ME', 'Montenegro'],
  ['MS', 'Montserrat'],
  ['MA', 'Morocco'],
  ['MZ', 'Mozambique'],
  ['MM', 'Myanmar (Burma)'],
  ['NA', 'Namibia'],
  ['NR', 'Nauru'],
  ['NP', 'Nepal'],
  ['NL', 'Netherlands'],
  ['NC', 'New Caledonia'],
  ['NZ', 'New Zealand'],
  ['NI', 'Nicaragua'],
  ['NE', 'Niger'],
  ['NG', 'Nigeria'],
  ['NU', 'Niue'],
  ['NF', 'Norfolk Island'],
  ['KP', 'North Korea'],
  ['MK', 'North Macedonia'],
  ['MP', 'Northern Mariana Islands'],
  ['NO', 'Norway'],
  ['OM', 'Oman'],
  ['PK', 'Pakistan'],
  ['PW', 'Palau'],
  ['PS', 'Palestinian Territories'],
  ['PA', 'Panama'],
  ['PG', 'Papua New Guinea'],
  ['PY', 'Paraguay'],
  ['PE', 'Peru'],
  ['PH', 'Philippines'],
  ['PN', 'Pitcairn Islands'],
  ['PL', 'Poland'],
  ['PT', 'Portugal'],
  ['PR', 'Puerto Rico'],
  ['QA', 'Qatar'],
  ['RE', 'Réunion'],
  ['RO', 'Romania'],
  ['RU', 'Russia'],
  ['RW', 'Rwanda'],
  ['WS', 'Samoa'],
  ['SM', 'San Marino'],
  ['ST', 'São Tomé & Príncipe'],
  ['SA', 'Saudi Arabia'],
  ['SN', 'Senegal'],
  ['RS', 'Serbia'],
  ['SC', 'Seychelles'],
  ['SL', 'Sierra Leone'],
  ['SG', 'Singapore'],
  ['SX', 'Sint Maarten'],
  ['SK', 'Slovakia'],
  ['SI', 'Slovenia'],
  ['SB', 'Solomon Islands'],
  ['SO', 'Somalia'],
  ['ZA', 'South Africa'],
  ['GS', 'South Georgia & South Sandwich Islands'],
  ['KR', 'South Korea'],
  ['SS', 'South Sudan'],
  ['ES', 'Spain'],
  ['LK', 'Sri Lanka'],
  ['BL', 'St. Barthélemy'],
  ['SH', 'St. Helena'],
  ['KN', 'St. Kitts & Nevis'],
  ['LC', 'St. Lucia'],
  ['MF', 'St. Martin'],
  ['PM', 'St. Pierre & Miquelon'],
  ['VC', 'St. Vincent & Grenadines'],
  ['SD', 'Sudan'],
  ['SR', 'Suriname'],
  ['SJ', 'Svalbard & Jan Mayen'],
  ['SE', 'Sweden'],
  ['CH', 'Switzerland'],
  ['SY', 'Syria'],
  ['TW', 'Taiwan'],
  ['TJ', 'Tajikistan'],
  ['TZ', 'Tanzania'],
  ['TH', 'Thailand'],
  ['TL', 'Timor-Leste'],
  ['TG', 'Togo'],
  ['TK', 'Tokelau'],
  ['TO', 'Tonga'],
  ['TT', 'Trinidad & Tobago'],
  ['TN', 'Tunisia'],
  ['TR', 'Türkiye'],
  ['TM', 'Turkmenistan'],
  ['TC', 'Turks & Caicos Islands'],
  ['TV', 'Tuvalu'],
  ['UM', 'U.S. Outlying Islands'],
  ['VI', 'U.S. Virgin Islands'],
  ['UG', 'Uganda'],
  ['UA', 'Ukraine'],
  ['AE', 'United Arab Emirates'],
  ['GB', 'United Kingdom'],
  ['US', 'United States'],
  ['UY', 'Uruguay'],
  ['UZ', 'Uzbekistan'],
  ['VU', 'Vanuatu'],
  ['VA', 'Vatican City'],
  ['VE', 'Venezuela'],
  ['VN', 'Vietnam'],
  ['WF', 'Wallis & Futuna'],
  ['EH', 'Western Sahara'],
  ['YE', 'Yemen'],
  ['ZM', 'Zambia'],
  ['ZW', 'Zimbabwe'],
];

/**
 * ISO 3166-1 alpha-2 codes for the countries blocked by Frame's compliance
 * policy. Mirrors the list in iOS `AvailableCountry.restrictedCountries`.
 *
 * Filtered by alpha-2 code rather than display name so that CLDR display-name
 * changes (e.g. renaming "Congo - Kinshasa") don't silently unblock a country.
 * Pass this to {@link getAvailableCountries} (the default) to get the filtered list.
 */
export const RESTRICTED_ALPHA2_CODES: ReadonlyArray<string> = [
  'IR', // Iran
  'RU', // Russia
  'KP', // North Korea
  'SY', // Syria
  'CU', // Cuba
  'CD', // Democratic Republic of Congo (Congo - Kinshasa in CLDR)
  'IQ', // Iraq
  'LY', // Libya
  'ML', // Mali
  'NI', // Nicaragua
  'SD', // Sudan
  'VE', // Venezuela
  'YE', // Yemen
];

/**
 * Display names of the restricted countries as they appear in the iOS SDK's
 * `AvailableCountry.restrictedCountries`. Kept for reference — **do not use
 * this for filtering**; current CLDR display names may differ (e.g. `'Congo -
 * Kinshasa'` vs `'Democratic Republic of Congo'`). Use
 * {@link RESTRICTED_ALPHA2_CODES} for all actual filtering.
 */
export const RESTRICTED_COUNTRY_NAMES: ReadonlyArray<string> = [
  'Iran',
  'Russia',
  'North Korea',
  'Syria',
  'Cuba',
  'Democratic Republic of Congo',
  'Iraq',
  'Libya',
  'Mali',
  'Nicaragua',
  'Sudan',
  'Venezuela',
  'Yemen',
];

/**
 * A country entry used in address and country-picker UI. Returned by
 * {@link getAllCountries} and {@link getAvailableCountries}.
 */
export interface AvailableCountry {
  /** ISO 3166-1 alpha-2 code (e.g. `'US'`). */
  alpha2Code: string;
  /** Localized display name (e.g. `'United States'`). */
  displayName: string;
}

/**
 * A country entry augmented with calling code and flag emoji. Returned by
 * {@link getPhoneCountries} for use in phone-number country pickers.
 */
export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 code (e.g. `'US'`). */
  alpha2Code: string;
  /** Localized display name (e.g. `'United States'`). */
  displayName: string;
  /** ITU calling code prefixed with `+` (e.g. `'+1'`). */
  callingCode: string;
  /** Regional indicator emoji pair representing the country flag (e.g. `'🇺🇸'`). */
  flag: string;
}

let allCountriesCache: AvailableCountry[] | null = null;

/**
 * Returns the full list of countries known to the SDK, sorted alphabetically
 * by display name. Results are cached after the first call.
 *
 * @returns All {@link AvailableCountry} entries including restricted ones.
 */
export function getAllCountries(): AvailableCountry[] {
  if (allCountriesCache) return allCountriesCache;
  allCountriesCache = COUNTRIES.map(([alpha2Code, displayName]) => ({ alpha2Code, displayName }));
  return allCountriesCache;
}

/**
 * Returns the list of countries with compliance-restricted countries removed.
 * By default uses {@link RESTRICTED_ALPHA2_CODES}; pass a custom list to
 * override.
 *
 * @param restrictedAlpha2 - Alpha-2 codes to exclude. Defaults to {@link RESTRICTED_ALPHA2_CODES}.
 * @returns {@link AvailableCountry} entries with blocked countries filtered out.
 */
export function getAvailableCountries(
  restrictedAlpha2: ReadonlyArray<string> = RESTRICTED_ALPHA2_CODES,
): AvailableCountry[] {
  const blocked = new Set(restrictedAlpha2);
  return getAllCountries().filter((c) => !blocked.has(c.alpha2Code));
}

/**
 * The default country pre-selected in Frame address and country-picker UI
 * (`'US'` — United States).
 */
export const DEFAULT_COUNTRY: AvailableCountry = {
  alpha2Code: 'US',
  displayName: 'United States',
};

/**
 * Converts an ISO 3166-1 alpha-2 code to its regional indicator flag emoji.
 * Returns an empty string for invalid input.
 *
 * @param alpha2 - A 2-letter country code (case-insensitive, e.g. `'US'` or `'us'`).
 * @returns The flag emoji string (e.g. `'🇺🇸'`), or `''` if the input is not valid.
 *
 * @example
 * ```ts
 * alpha2ToFlag('GB'); // '🇬🇧'
 * alpha2ToFlag('XX'); // '' (invalid code)
 * ```
 */
export function alpha2ToFlag(alpha2: string): string {
  if (alpha2.length !== 2) return '';
  const upper = alpha2.toUpperCase();
  const first = upper.charCodeAt(0);
  const second = upper.charCodeAt(1);
  if (first < 65 || first > 90 || second < 65 || second > 90) return '';
  return String.fromCodePoint(0x1f1e6 + (first - 65), 0x1f1e6 + (second - 65));
}

let phoneCountriesCache: PhoneCountry[] | null = null;
const NAME_BY_ALPHA2: Record<string, string> = Object.fromEntries(COUNTRIES);

/**
 * Returns the list of countries with calling codes and flag emojis, sorted
 * alphabetically by display name. Suitable for populating a phone-number
 * country-code picker. Results are cached after the first call.
 *
 * @returns All {@link PhoneCountry} entries sorted by `displayName`.
 */
export function getPhoneCountries(): PhoneCountry[] {
  if (phoneCountriesCache) return phoneCountriesCache;
  phoneCountriesCache = getCountries()
    .map(
      (alpha2: CountryCode): PhoneCountry => ({
        alpha2Code: alpha2,
        displayName: NAME_BY_ALPHA2[alpha2] ?? alpha2,
        callingCode: `+${getCountryCallingCode(alpha2)}`,
        flag: alpha2ToFlag(alpha2),
      }),
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  return phoneCountriesCache;
}
