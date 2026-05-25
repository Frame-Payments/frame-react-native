import { convertCentsToCurrencyString } from '../currency';

describe('convertCentsToCurrencyString', () => {
  it('formats USD by default', () => {
    expect(convertCentsToCurrencyString(15000, 'USD', 'en-US')).toBe('$150.00');
  });

  it('always shows 2 decimals', () => {
    expect(convertCentsToCurrencyString(100, 'USD', 'en-US')).toBe('$1.00');
    expect(convertCentsToCurrencyString(1, 'USD', 'en-US')).toBe('$0.01');
    expect(convertCentsToCurrencyString(0, 'USD', 'en-US')).toBe('$0.00');
  });

  it('formats other currencies with their conventional sign', () => {
    expect(convertCentsToCurrencyString(15000, 'EUR', 'en-US')).toBe('€150.00');
    expect(convertCentsToCurrencyString(15000, 'GBP', 'en-US')).toBe('£150.00');
    expect(convertCentsToCurrencyString(15000, 'JPY', 'en-US')).toBe('¥150.00');
  });

  it('uses the supplied locale for thousands separators', () => {
    expect(convertCentsToCurrencyString(150000000, 'USD', 'en-US')).toBe('$1,500,000.00');
    expect(convertCentsToCurrencyString(150000000, 'EUR', 'de-DE')).toMatch(/1\.500\.000,00.*€/);
  });

  it('handles negative amounts with accounting parens (iOS NumberFormatter parity)', () => {
    expect(convertCentsToCurrencyString(-150, 'USD', 'en-US')).toBe('($1.50)');
  });

  it('returns empty string for non-finite input', () => {
    expect(convertCentsToCurrencyString(NaN)).toBe('');
    expect(convertCentsToCurrencyString(Infinity)).toBe('');
  });

  it('falls back to ISO code + amount when the currency code is unknown', () => {
    expect(convertCentsToCurrencyString(150, 'XYZZY', 'en-US')).toBe('XYZZY 1.50');
  });
});
