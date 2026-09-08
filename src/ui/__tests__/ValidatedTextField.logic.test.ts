import { applyInputRestriction, truncateToLimit } from '../primitives/textFieldUtils';

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

describe('applyInputRestriction', () => {
  it('passes everything through when unrestricted', () => {
    expect(applyInputRestriction('a1!@#', undefined)).toBe('a1!@#');
    expect(applyInputRestriction('a1!@#', 'none')).toBe('a1!@#');
  });

  it('keeps letters, whitespace and name punctuation', () => {
    // The punctuation real names and place names contain.
    expect(applyInputRestriction("O'Fallon", 'textOnly')).toBe("O'Fallon");
    expect(applyInputRestriction('Stoke-on-Trent', 'textOnly')).toBe('Stoke-on-Trent');
    expect(applyInputRestriction('St. Louis', 'textOnly')).toBe('St. Louis');
    expect(applyInputRestriction('Martin Luther King Jr.', 'textOnly')).toBe('Martin Luther King Jr.');
  });

  it('keeps non-ASCII letters', () => {
    // Names here are compared against a government ID during KYC, so dropping a
    // character the legal name contains would cause a verification failure.
    expect(applyInputRestriction('José', 'textOnly')).toBe('José');
    expect(applyInputRestriction('Müller', 'textOnly')).toBe('Müller');
    expect(applyInputRestriction('李', 'textOnly')).toBe('李');
  });

  it('strips digits and other punctuation', () => {
    expect(applyInputRestriction('Ann4 Smith!', 'textOnly')).toBe('Ann Smith');
    expect(applyInputRestriction('a@b#c', 'textOnly')).toBe('abc');
  });
});
