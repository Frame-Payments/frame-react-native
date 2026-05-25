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

// Alpha-2 codes for the 13 entries in iOS `AvailableCountry.restrictedCountries`.
// Filtering by alpha-2 rather than display name guarantees CD (Congo - Kinshasa
// in current CLDR) is actually blocked — the iOS port filters by name and would
// silently let DRC through if/when CLDR ever renames the entry.
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

// Kept for backward compatibility / documentation — these are the names from
// iOS `AvailableCountry.restrictedCountries`, NOT what current CLDR returns.
// Use RESTRICTED_ALPHA2_CODES for the actual filter.
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

export interface AvailableCountry {
  alpha2Code: string;
  displayName: string;
}

export interface PhoneCountry {
  alpha2Code: string;
  displayName: string;
  callingCode: string;
  flag: string;
}

let allCountriesCache: AvailableCountry[] | null = null;

export function getAllCountries(): AvailableCountry[] {
  if (allCountriesCache) return allCountriesCache;
  allCountriesCache = COUNTRIES.map(([alpha2Code, displayName]) => ({ alpha2Code, displayName }));
  return allCountriesCache;
}

export function getAvailableCountries(
  restrictedAlpha2: ReadonlyArray<string> = RESTRICTED_ALPHA2_CODES,
): AvailableCountry[] {
  const blocked = new Set(restrictedAlpha2);
  return getAllCountries().filter((c) => !blocked.has(c.alpha2Code));
}

export const DEFAULT_COUNTRY: AvailableCountry = {
  alpha2Code: 'US',
  displayName: 'United States',
};

// Converts "US" → 🇺🇸 by shifting each ASCII letter to its regional indicator
// symbol (U+1F1E6 + offset from 'A').
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
