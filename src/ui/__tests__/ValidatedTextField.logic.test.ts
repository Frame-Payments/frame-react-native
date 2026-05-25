import { truncateToLimit } from '../primitives/textFieldUtils';

describe('truncateToLimit', () => {
  it('returns the value unchanged when limit is undefined', () => {
    expect(truncateToLimit('hello world', undefined)).toBe('hello world');
  });

  it('returns the value unchanged when it is already within the limit', () => {
    expect(truncateToLimit('abc', 5)).toBe('abc');
    expect(truncateToLimit('abcde', 5)).toBe('abcde');
  });

  it('truncates to the limit when the value is longer', () => {
    expect(truncateToLimit('abcdefgh', 5)).toBe('abcde');
  });

  it('ignores zero and negative limits (no truncation)', () => {
    expect(truncateToLimit('abc', 0)).toBe('abc');
    expect(truncateToLimit('abc', -1)).toBe('abc');
  });

  it('ignores non-integer limits', () => {
    expect(truncateToLimit('abcdef', 3.5)).toBe('abcdef');
    expect(truncateToLimit('abcdef', NaN)).toBe('abcdef');
    expect(truncateToLimit('abcdef', Infinity)).toBe('abcdef');
  });

  it('handles empty input under any limit', () => {
    expect(truncateToLimit('', 5)).toBe('');
    expect(truncateToLimit('', undefined)).toBe('');
  });
});
