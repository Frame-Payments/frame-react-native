import { addressFormatForCountry } from '../addressFormat';
import {
  CANADA_SUBREGIONS,
  UNITED_STATES_SUBREGIONS,
  findSubregion,
  normalizeSubregion,
  subregionCodesForCountry,
  subregionsForCountry,
} from '../addressSubregions';
import { validateSubregion } from '../validation';

describe('addressFormatForCountry', () => {
  it('returns the US entry, capped at 2 characters with a numeric postal keyboard', () => {
    expect(addressFormatForCountry('US')).toEqual({
      stateLabel: 'State',
      postalLabel: 'Zip Code',
      postalKeyboard: 'number-pad',
      stateMaxLength: 2,
    });
  });

  it('labels each country the way iOS does', () => {
    expect(addressFormatForCountry('CA').stateLabel).toBe('Province');
    expect(addressFormatForCountry('GB').stateLabel).toBe('County');
    expect(addressFormatForCountry('JP').stateLabel).toBe('Prefecture');
    expect(addressFormatForCountry('IE').postalLabel).toBe('Eircode');
    expect(addressFormatForCountry('IN').postalLabel).toBe('PIN Code');
    expect(addressFormatForCountry('BR').postalLabel).toBe('CEP');
  });

  it('leaves the state length unrestricted outside the US and Canada', () => {
    expect(addressFormatForCountry('GB').stateMaxLength).toBeUndefined();
    expect(addressFormatForCountry('JP').stateMaxLength).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(addressFormatForCountry('gb')).toEqual(addressFormatForCountry('GB'));
  });

  it('falls back to a generic format for an unlisted country', () => {
    expect(addressFormatForCountry('ZA')).toEqual({
      stateLabel: 'State',
      postalLabel: 'Postal Code',
      postalKeyboard: 'default',
    });
  });
});

describe('addressSubregions', () => {
  it('carries all 56 US subregions and 13 Canadian ones', () => {
    expect(UNITED_STATES_SUBREGIONS).toHaveLength(56);
    expect(CANADA_SUBREGIONS).toHaveLength(13);
  });

  it('returns null for a country whose subregion is free text', () => {
    expect(subregionsForCountry('GB')).toBeNull();
    expect(subregionCodesForCountry('GB')).toBeNull();
  });

  it('treats an empty country as the US, matching iOS form defaults', () => {
    expect(subregionsForCountry('')).toBe(UNITED_STATES_SUBREGIONS);
    expect(subregionsForCountry('   ')).toBe(UNITED_STATES_SUBREGIONS);
  });

  it('finds a subregion case-insensitively', () => {
    expect(findSubregion('ca', 'US')).toEqual({ code: 'CA', name: 'California' });
    expect(findSubregion(' on ', 'CA')).toEqual({ code: 'ON', name: 'Ontario' });
    expect(findSubregion('ZZ', 'US')).toBeNull();
  });

  it('upper-cases only where subregions are codes', () => {
    expect(normalizeSubregion(' ca ', 'US')).toBe('CA');
    expect(normalizeSubregion(' on ', 'CA')).toBe('ON');
    expect(normalizeSubregion(' Greater London ', 'GB')).toBe('Greater London');
  });
});

describe('validateSubregion', () => {
  it('accepts a valid code, case-insensitively', () => {
    expect(validateSubregion('CA', 'US')).toBeNull();
    expect(validateSubregion('ca', 'US')).toBeNull();
    expect(validateSubregion('ON', 'CA')).toBeNull();
  });

  it('rejects text that is not an accepted code', () => {
    expect(validateSubregion('Californiaa', 'US')).toBe('Enter a valid 2-letter state');
    expect(validateSubregion('XX', 'US')).toBe('Enter a valid 2-letter state');
  });

  it('uses the country label in the message', () => {
    expect(validateSubregion('', 'US')).toBe('State is required');
    expect(validateSubregion('', 'CA')).toBe('Province is required');
    expect(validateSubregion('', 'GB')).toBe('County is required');
    expect(validateSubregion('XX', 'CA')).toBe('Enter a valid 2-letter province');
  });

  it('accepts any non-empty value for a free-text country', () => {
    expect(validateSubregion('Greater London', 'GB')).toBeNull();
    expect(validateSubregion('Gauteng', 'ZA')).toBeNull();
  });

  it('still requires a value for a free-text country', () => {
    expect(validateSubregion('   ', 'GB')).toBe('County is required');
  });
});
