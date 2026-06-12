import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ISO 3166-1 alpha-2 country codes for which {@link validatePostalCode} can
 * validate postal-code format. Other country codes are accepted but not
 * validated (the function returns `null`).
 *
 * Use {@link getSupportedPostalCodeCountries} to retrieve this list at runtime.
 */
export const POSTAL_CODE_COUNTRIES = [
  'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'MX',
  'IN', 'JP', 'BR', 'IT', 'ES', 'IE', 'NZ', 'SG',
] as const;

/**
 * Union of country codes that have a known postal-code regex in this SDK.
 * Derived from {@link POSTAL_CODE_COUNTRIES}.
 */
export type PostalCountryCode = (typeof POSTAL_CODE_COUNTRIES)[number];

const POSTAL_REGEXES: Record<PostalCountryCode, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/,
  AU: /^\d{4}$/,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  NL: /^\d{4}\s?[A-Za-z]{2}$/,
  MX: /^\d{5}$/,
  IN: /^\d{6}$/,
  JP: /^\d{3}-?\d{4}$/,
  BR: /^\d{5}-?\d{3}$/,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
  IE: /^[A-Za-z]\d{2}\s?[A-Za-z\d]{4}$/,
  NZ: /^\d{4}$/,
  SG: /^\d{6}$/,
};

// IIN (Issuer Identification Number) → brand. Order matters: longer prefixes
// must be checked before shorter ones (e.g. 34/37 amex before 3 generic).
// Length list is what each brand's PAN can be — used by validateCard().
const CARD_BRANDS: ReadonlyArray<{
  brand: string;
  prefixes: ReadonlyArray<string>;
  lengths: ReadonlyArray<number>;
}> = [
  { brand: 'amex', prefixes: ['34', '37'], lengths: [15] },
  { brand: 'visa', prefixes: ['4'], lengths: [13, 16, 19] },
  {
    brand: 'mastercard',
    prefixes: ['51', '52', '53', '54', '55', '2221', '2222', '2223', '2224', '2225', '2226', '2227', '2228', '2229',
               '223', '224', '225', '226', '227', '228', '229', '23', '24', '25', '26', '270', '271', '2720'],
    lengths: [16],
  },
  { brand: 'discover', prefixes: ['6011', '644', '645', '646', '647', '648', '649', '65'], lengths: [16, 19] },
  { brand: 'diners', prefixes: ['300', '301', '302', '303', '304', '305', '36', '38', '39'], lengths: [14, 16, 19] },
  { brand: 'jcb', prefixes: ['35'], lengths: [16, 17, 18, 19] },
  { brand: 'unionpay', prefixes: ['62'], lengths: [16, 17, 18, 19] },
];

function detectBrand(pan: string): { brand: string; lengths: ReadonlyArray<number> } | null {
  for (const entry of CARD_BRANDS) {
    if (entry.prefixes.some((p) => pan.startsWith(p))) {
      return { brand: entry.brand, lengths: entry.lengths };
    }
  }
  return null;
}

function luhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Returns an error message if `value` is blank, or `null` if it is non-empty.
 *
 * @param value - The string to check.
 * @param fieldName - Display name used in the error message (e.g. `'Email'`).
 * @returns `null` on success, or a localized error string.
 */
export function validateNonEmpty(value: string, fieldName: string): string | null {
  return value.trim() === '' ? `${fieldName} is required` : null;
}

/**
 * Returns an error message if `value` does not contain at least two
 * whitespace-separated name parts, or `null` if it does.
 *
 * @param value - The full name string to validate.
 * @returns `null` on success, or a localized error string.
 */
export function validateFullName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return 'Full name is required';
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);
  return parts.length >= 2 ? null : 'Enter first and last name';
}

/**
 * Returns an error message if `value` is not a syntactically valid email
 * address, or `null` if it is. Uses a lightweight `user@domain.tld` pattern —
 * not RFC 5322 exhaustive.
 *
 * @param value - The email address string to validate.
 * @returns `null` on success, or a localized error string.
 */
export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return 'Email is required';
  return EMAIL_PATTERN.test(trimmed) ? null : 'Enter a valid email address';
}

/**
 * Returns an error message if `value` is not a 5-digit US ZIP code, or `null`
 * if it is. For international postal codes use {@link validatePostalCode}.
 *
 * @param value - The ZIP code string to validate.
 * @returns `null` on success, or a localized error string.
 */
export function validateZipUS(value: string): string | null {
  if (value === '') return 'Zip code is required';
  const isValid = value.length === 5 && /^\d{5}$/.test(value);
  return isValid ? null : 'Enter a 5-digit zip code';
}

/**
 * Returns an error message if `cardNumber` fails brand detection, length
 * validation, or the Luhn check; returns `null` if the number is valid.
 * Accepts whitespace-separated input (e.g. `'4111 1111 1111 1111'`).
 *
 * @param cardNumber - The raw card number string to validate.
 * @returns `null` on success, or a localized error string.
 */
export function validateCard(cardNumber: string): string | null {
  const digits = cardNumber.replace(/\s/g, '');
  if (digits === '') return 'Enter valid card details';
  if (!/^\d+$/.test(digits)) return 'Enter valid card details';
  const match = detectBrand(digits);
  if (!match) return 'Enter valid card details';
  if (!match.lengths.includes(digits.length)) return 'Enter valid card details';
  if (!luhn(digits)) return 'Enter valid card details';
  return null;
}

/**
 * Returns the card network brand for the given card number prefix, or `null`
 * if the prefix does not match a known brand. Accepts whitespace-separated
 * input. Does **not** perform a Luhn check — use {@link validateCard} for full
 * validation.
 *
 * @param cardNumber - The raw card number string.
 * @returns A brand string such as `'visa'`, `'mastercard'`, `'amex'`, etc., or `null`.
 */
export function detectCardBrand(cardNumber: string): string | null {
  const digits = cardNumber.replace(/\s/g, '');
  const match = detectBrand(digits);
  return match?.brand ?? null;
}

// Amex prints a 4-digit CID on the front of the card; everyone else prints a
// 3-digit CVV/CVC on the back. JCB and UnionPay sometimes use 4 too but
// historically accept 3 — mirror iOS Validators which uses brand=amex as the
// only 4-digit case.
export function validateCVC(cvc: string, brand: string | null): string | null {
  const trimmed = cvc.replace(/\s/g, '');
  if (trimmed === '') return 'Enter the card security code';
  if (!/^\d+$/.test(trimmed)) return 'Enter the card security code';
  const expected = brand === 'amex' ? 4 : 3;
  return trimmed.length === expected ? null : 'Enter the card security code';
}

/**
 * Returns an error message if the given month/year combination is not a valid
 * future expiry date, or `null` if it is. Accepts 2-digit years (`'27'`) and
 * 4-digit years (`'2027'`). A card expiring in the current calendar month is
 * considered valid.
 *
 * @param month - Expiration month as a 1–2 digit string (`'1'`–`'12'`).
 * @param year - Expiration year as a 2- or 4-digit string.
 * @param now - Reference date used for the expiry comparison (injectable for testing).
 * @returns `null` on success, or a localized error string.
 */
export function validateCardExpiry(month: string, year: string, now: Date = new Date()): string | null {
  const m = parseIntStrict(month);
  if (m === null || m < 1 || m > 12) return 'Invalid expiration month';

  const yearString = year.length === 2 ? `20${year}` : year;
  const y = parseIntStrict(yearString);
  if (y === null || y < 2000 || y > 2100) return 'Invalid expiration year';

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (y < currentYear || (y === currentYear && m < currentMonth)) {
    return 'Card has expired';
  }
  return null;
}

// Like Swift's `Int(_:)` — accepts only digit strings (optionally with a
// leading sign). Rejects scientific notation (`5e2`), decimals (`5.5`),
// whitespace-padded values, and empty strings.
function parseIntStrict(value: string): number | null {
  if (!/^-?\d+$/.test(value)) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Returns an error message if `value` is not exactly 4 decimal digits, or
 * `null` if it is. Used to validate the last-four-digits SSN field in KYC
 * onboarding.
 *
 * @param value - The 4-digit SSN string to validate.
 * @returns `null` on success, or a localized error string.
 */
export function validateSSNLast4(value: string): string | null {
  if (value === '') return 'SSN is required';
  const isValid = value.length === 4 && /^\d{4}$/.test(value);
  return isValid ? null : 'Enter last 4 digits of SSN';
}

/**
 * Returns an error message if `value` is not a structurally valid US ABA
 * routing number (9 digits, passing the ABA checksum), or `null` if it is.
 *
 * @param value - The routing number string to validate.
 * @returns `null` on success, or a localized error string.
 */
export function validateRoutingNumberUS(value: string): string | null {
  if (value === '') return 'Routing number is required';
  if (value.length !== 9 || !/^\d{9}$/.test(value)) {
    return 'Enter a 9-digit routing number';
  }
  const d = Array.from(value, (c) => Number(c));
  // ABA checksum: 3·(d0+d3+d6) + 7·(d1+d4+d7) + (d2+d5+d8) ≡ 0 (mod 10)
  const checksum =
    (3 * (d[0]! + d[3]! + d[6]!) + 7 * (d[1]! + d[4]! + d[7]!) + (d[2]! + d[5]! + d[8]!)) % 10;
  return checksum === 0 ? null : 'Enter a valid routing number';
}

/**
 * Returns an error message if `value` is not a digit-only string within the
 * accepted length range, or `null` if it is.
 *
 * @param value - The account number string to validate.
 * @param min - Minimum digit count (inclusive). Defaults to `4`.
 * @param max - Maximum digit count (inclusive). Defaults to `17`.
 * @returns `null` on success, or a localized error string.
 */
export function validateAccountNumberUS(value: string, min: number = 4, max: number = 17): string | null {
  if (value === '') return 'Account number is required';
  const isValid = /^\d+$/.test(value) && value.length >= min && value.length <= max;
  return isValid ? null : 'Enter a valid account number';
}

/**
 * Returns an error message if the year/month/day combination is not a valid
 * calendar date, or the derived age falls outside `[minAge, maxAge]`, or
 * `null` if all checks pass.
 *
 * Age is computed in local time on `now` to match iOS `Calendar.current`
 * behaviour — callers on negative-UTC offsets compute the same age as the
 * native SDK.
 *
 * @param year - 4-digit year string (e.g. `'1990'`).
 * @param month - 1–2 digit month string (e.g. `'6'` or `'06'`).
 * @param day - 1–2 digit day string (e.g. `'15'`).
 * @param minAge - Minimum accepted age in years (inclusive). Defaults to `18`.
 * @param maxAge - Maximum accepted age in years (inclusive). Defaults to `120`.
 * @param now - Reference date for the age calculation (injectable for testing).
 * @returns `null` on success, or a localized error string.
 */
export function validateDateOfBirth(
  year: string,
  month: string,
  day: string,
  minAge: number = 18,
  maxAge: number = 120,
  now: Date = new Date(),
): string | null {
  if (year === '' || month === '' || day === '') return 'Date of birth is required';
  if (year.length !== 4) return 'Enter a valid date of birth';

  const y = parseIntStrict(year);
  const m = parseIntStrict(month);
  const d = parseIntStrict(day);
  if (y === null || m === null || d === null) return 'Enter a valid date of birth';
  if (m < 1 || m > 12 || d < 1) return 'Enter a valid date of birth';

  // Validate the calendar date round-trips (rejects e.g. Feb 31). The check
  // uses UTC but compares only the tuple — timezone is irrelevant here.
  const candidate = new Date(Date.UTC(y, m - 1, d));
  if (
    candidate.getUTCFullYear() !== y ||
    candidate.getUTCMonth() !== m - 1 ||
    candidate.getUTCDate() !== d
  ) {
    return 'Enter a valid date of birth';
  }

  // Age math uses local time on `now` to match iOS `Calendar.current` so users
  // on the date boundary in negative-UTC offsets compute the same age the
  // native SDK reports.
  let age = now.getFullYear() - y;
  const monthDelta = now.getMonth() - (m - 1);
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < d)) age -= 1;

  if (age < minAge) return `You must be at least ${minAge} years old`;
  if (age > maxAge) return 'Enter a valid date of birth';
  return null;
}

/**
 * Returns an error message if `value` does not match the postal-code format
 * for `countryCode`, or `null` if it does (or if the country has no known
 * pattern). Country codes not listed in {@link POSTAL_CODE_COUNTRIES} are
 * accepted without format validation.
 *
 * @param value - The postal code string to validate.
 * @param countryCode - ISO 3166-1 alpha-2 country code (case-insensitive).
 * @returns `null` on success, or a localized error string.
 */
export function validatePostalCode(value: string, countryCode: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return 'Postal code is required';
  const pattern = POSTAL_REGEXES[countryCode.toUpperCase() as PostalCountryCode];
  if (!pattern) return null;
  return pattern.test(trimmed) ? null : 'Enter a valid postal code';
}

/**
 * Returns the list of ISO 3166-1 alpha-2 country codes for which
 * {@link validatePostalCode} applies a format regex. Useful for building
 * country-picker filter lists.
 *
 * @returns A readonly array of {@link PostalCountryCode} values.
 */
export function getSupportedPostalCodeCountries(): ReadonlyArray<PostalCountryCode> {
  return POSTAL_CODE_COUNTRIES;
}

/**
 * Checks the phone number is *possible* for the given region — i.e. correct
 * digit count and a valid country-code prefix. Mirrors iOS PhoneNumberKit's
 * `parse(_:withRegion:ignoreType:)` which performs the same lenient check.
 * Returns null on a number that's "possible" even if not assigned in the
 * national plan (e.g. a UK-formatted number with `+44` still passes when the
 * region is 'US').
 */
export function validatePhoneE164(raw: string, regionCode: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return 'Phone number is required';
  try {
    const parsed = parsePhoneNumberFromString(trimmed, regionCode as CountryCode);
    if (!parsed || !parsed.isPossible()) return 'Enter a valid phone number';
    return null;
  } catch {
    return 'Enter a valid phone number';
  }
}
