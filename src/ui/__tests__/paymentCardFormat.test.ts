import {
  applyCvcInput,
  applyExpiryInput,
  applyPanInput,
  cvcMaxDigits,
  emptyCardFieldState,
  formatExpiryDisplay,
  formatPanDisplay,
  panMaxDigits,
  parseExpiry,
  sanitizeCvcInput,
  sanitizePanInput,
} from '../primitives/paymentCardFormat';
import { validateCVC } from '../../validation';

describe('panMaxDigits / cvcMaxDigits', () => {
  it('returns brand-specific max for PAN', () => {
    expect(panMaxDigits('amex')).toBe(15);
    expect(panMaxDigits('visa')).toBe(19);
    expect(panMaxDigits('mastercard')).toBe(16);
    expect(panMaxDigits(null)).toBe(19);
  });

  it('returns brand-specific max for CVC', () => {
    expect(cvcMaxDigits('amex')).toBe(4);
    expect(cvcMaxDigits('visa')).toBe(3);
    expect(cvcMaxDigits(null)).toBe(3);
  });
});

describe('sanitizePanInput', () => {
  it('strips non-digits', () => {
    expect(sanitizePanInput('4242 4242 4242 4242', 'visa')).toBe('4242424242424242');
  });

  it('caps at the brand max', () => {
    expect(sanitizePanInput('424242424242424242422222', 'mastercard')).toBe('4242424242424242');
  });

  it('falls back to 19 digits when brand is unknown', () => {
    expect(sanitizePanInput('1234567890123456789012345', null)).toBe('1234567890123456789');
  });
});

describe('formatPanDisplay', () => {
  it('formats amex as 4-6-5', () => {
    expect(formatPanDisplay('378282246310005', 'amex')).toBe('3782 822463 10005');
  });

  it('formats visa as 4-4-4-4 (16-digit)', () => {
    expect(formatPanDisplay('4242424242424242', 'visa')).toBe('4242 4242 4242 4242');
  });

  it('formats 19-digit visa as 4-4-4-4-3', () => {
    expect(formatPanDisplay('4242424242424242421', 'visa')).toBe('4242 4242 4242 4242 421');
  });

  it('handles partial inputs', () => {
    expect(formatPanDisplay('424', 'visa')).toBe('424');
    expect(formatPanDisplay('', 'visa')).toBe('');
  });
});

describe('sanitizeCvcInput', () => {
  it('caps amex at 4, others at 3', () => {
    expect(sanitizeCvcInput('12345', 'amex')).toBe('1234');
    expect(sanitizeCvcInput('12345', 'visa')).toBe('123');
  });

  it('strips non-digits', () => {
    expect(sanitizeCvcInput('1a2b3', 'visa')).toBe('123');
  });
});

describe('formatExpiryDisplay', () => {
  it('pads single-digit month into MM/', () => {
    expect(formatExpiryDisplay('3')).toBe('03/');
    expect(formatExpiryDisplay('9')).toBe('09/');
  });

  it('passes 0 and 1 through without padding (waiting for second digit)', () => {
    expect(formatExpiryDisplay('0')).toBe('0');
    expect(formatExpiryDisplay('1')).toBe('1');
  });

  it('rejects invalid month, keeps only first digit', () => {
    expect(formatExpiryDisplay('13')).toBe('1');
    expect(formatExpiryDisplay('99')).toBe('9'); // 99 not a month — strips to first
  });

  it('inserts slash after 2-digit month', () => {
    expect(formatExpiryDisplay('12')).toBe('12/');
    expect(formatExpiryDisplay('06')).toBe('06/');
  });

  it('appends year digits', () => {
    expect(formatExpiryDisplay('1229')).toBe('12/29');
    expect(formatExpiryDisplay('129')).toBe('12/9');
  });

  it('caps at 4 digits total', () => {
    expect(formatExpiryDisplay('122999')).toBe('12/29');
  });

  it('strips slashes from raw input then re-formats', () => {
    expect(formatExpiryDisplay('12/29')).toBe('12/29');
  });

  it('returns empty for empty input', () => {
    expect(formatExpiryDisplay('')).toBe('');
  });
});

describe('parseExpiry', () => {
  it('parses MM/YY', () => {
    expect(parseExpiry('12/29')).toEqual({ month: '12', year: '29' });
  });

  it('returns null for incomplete or malformed input', () => {
    expect(parseExpiry('1/29')).toBeNull();
    expect(parseExpiry('12/')).toBeNull();
    expect(parseExpiry('1229')).toBeNull();
    expect(parseExpiry('')).toBeNull();
  });
});

describe('applyPanInput', () => {
  it('updates brand based on PAN and resizes CVC when brand changes', () => {
    let state = emptyCardFieldState();
    // Type a visa
    state = applyPanInput(state, '4242');
    expect(state.brand).toBe('visa');

    // Add CVC of 4 (longer than visa's max 3) — for now it stays since CVC input is filtered separately
    state = applyCvcInput(state, '1234');
    expect(state.cvcRaw).toBe('123'); // visa cap

    // Switch to amex prefix
    state = applyPanInput(state, '3782');
    expect(state.brand).toBe('amex');
    // CVC was '123'; amex allows 4, so '123' is still valid and unchanged.
    expect(state.cvcRaw).toBe('123');
  });

  it('shrinks CVC when switching FROM amex TO visa', () => {
    let state = emptyCardFieldState();
    state = applyPanInput(state, '37828');
    expect(state.brand).toBe('amex');
    state = applyCvcInput(state, '1234');
    expect(state.cvcRaw).toBe('1234');

    state = applyPanInput(state, '4242');
    expect(state.brand).toBe('visa');
    expect(state.cvcRaw).toBe('123');
  });

  it('caps PAN at brand max', () => {
    let state = emptyCardFieldState();
    state = applyPanInput(state, '3782 8224 6310 0051234');
    expect(state.brand).toBe('amex');
    expect(state.panRaw.length).toBe(15); // amex cap
    expect(state.panDisplay).toBe('3782 822463 10005');
  });
});

describe('validateCVC integration', () => {
  it('agrees with sanitizeCvcInput on length', () => {
    expect(validateCVC('123', 'visa')).toBeNull();
    expect(validateCVC('12', 'visa')).not.toBeNull();
    expect(validateCVC('1234', 'amex')).toBeNull();
    expect(validateCVC('123', 'amex')).not.toBeNull();
  });
});
