import {
  DEFAULT_COUNTRY,
  RESTRICTED_ALPHA2_CODES,
  RESTRICTED_COUNTRY_NAMES,
  alpha2ToFlag,
  getAllCountries,
  getAvailableCountries,
  getPhoneCountries,
} from '../countries';

describe('getAllCountries', () => {
  it('returns 249 ISO 3166-1 alpha-2 regions (excludes exceptional reservations like XK / AC / EA)', () => {
    const all = getAllCountries();
    expect(all.length).toBe(249);
    const codes = all.map((c) => c.alpha2Code);
    for (const phantom of ['XK', 'AC', 'EA', 'IC', 'TA', 'DG']) {
      expect(codes).not.toContain(phantom);
    }
  });

  it('is sorted by displayName ascending', () => {
    const all = getAllCountries();
    const sorted = [...all].sort((a, b) => a.displayName.localeCompare(b.displayName));
    expect(all).toEqual(sorted);
  });

  it('includes United States with alpha2 "US"', () => {
    const us = getAllCountries().find((c) => c.alpha2Code === 'US');
    expect(us).toBeDefined();
    expect(us!.displayName).toBe('United States');
  });

  it('memoizes (subsequent calls return the same array reference)', () => {
    expect(getAllCountries()).toBe(getAllCountries());
  });
});

describe('getAvailableCountries', () => {
  it('excludes the 13 restricted alpha-2 codes by default', () => {
    const codes = new Set(getAvailableCountries().map((c) => c.alpha2Code));
    for (const restricted of RESTRICTED_ALPHA2_CODES) {
      expect(codes.has(restricted)).toBe(false);
    }
  });

  it('CD (DRC) is blocked even though CLDR renames it to "Congo - Kinshasa" (regression for the iOS name-based bypass)', () => {
    const codes = getAvailableCountries().map((c) => c.alpha2Code);
    expect(codes).not.toContain('CD');
  });

  it('respects custom restricted list (alpha-2)', () => {
    const available = getAvailableCountries(['US']).map((c) => c.alpha2Code);
    expect(available).not.toContain('US');
    // Default restrictions are not applied when custom list is passed.
    expect(available).toContain('RU');
  });

  it('empty restricted list returns everything', () => {
    const all = getAllCountries();
    const available = getAvailableCountries([]);
    expect(available.length).toBe(all.length);
  });
});

describe('alpha2ToFlag', () => {
  it('converts ISO codes to flag emoji', () => {
    expect(alpha2ToFlag('US')).toBe('🇺🇸');
    expect(alpha2ToFlag('GB')).toBe('🇬🇧');
    expect(alpha2ToFlag('jp')).toBe('🇯🇵');
  });

  it('returns empty string for invalid input', () => {
    expect(alpha2ToFlag('USA')).toBe('');
    expect(alpha2ToFlag('U')).toBe('');
    expect(alpha2ToFlag('U1')).toBe('');
    expect(alpha2ToFlag('')).toBe('');
  });
});

describe('getPhoneCountries', () => {
  it('returns a non-empty list', () => {
    const countries = getPhoneCountries();
    expect(countries.length).toBeGreaterThan(200);
  });

  it('every entry has all required fields', () => {
    for (const entry of getPhoneCountries()) {
      expect(entry.alpha2Code).toMatch(/^[A-Z]{2}$/);
      expect(entry.callingCode).toMatch(/^\+\d+$/);
      expect(entry.displayName.length).toBeGreaterThan(0);
      expect(entry.flag.length).toBeGreaterThan(0);
    }
  });

  it('US entry has +1', () => {
    const us = getPhoneCountries().find((c) => c.alpha2Code === 'US');
    expect(us?.callingCode).toBe('+1');
    expect(us?.flag).toBe('🇺🇸');
  });

  it('is sorted by displayName', () => {
    const list = getPhoneCountries();
    const sorted = [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
    expect(list).toEqual(sorted);
  });
});

describe('DEFAULT_COUNTRY', () => {
  it('is United States', () => {
    expect(DEFAULT_COUNTRY).toEqual({ alpha2Code: 'US', displayName: 'United States' });
  });
});

describe('RESTRICTED_COUNTRY_NAMES', () => {
  it('matches the iOS list verbatim (13 entries)', () => {
    expect(RESTRICTED_COUNTRY_NAMES).toEqual([
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
    ]);
  });
});
