import {
  OTP_LENGTH,
  emptyOtp,
  fromString,
  handleBackspace,
  handleSlotChange,
  toString,
} from '../primitives/otpFieldLogic';

describe('fromString / toString', () => {
  it('pads short input to 6 slots with empty strings', () => {
    expect(fromString('12')).toEqual(['1', '2', '', '', '', '']);
  });

  it('truncates input longer than 6 digits', () => {
    expect(fromString('1234567')).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('strips non-digits', () => {
    expect(fromString('1a2b3')).toEqual(['1', '2', '3', '', '', '']);
  });

  it('toString concatenates without padding', () => {
    expect(toString(['1', '2', '3', '', '', ''])).toBe('123');
    expect(toString(emptyOtp())).toBe('');
  });
});

describe('handleSlotChange — single character', () => {
  it('writes the digit and advances focus', () => {
    const r = handleSlotChange(emptyOtp(), 0, '4');
    expect(r.next).toEqual(['4', '', '', '', '', '']);
    expect(r.focusIndex).toBe(1);
  });

  it('clamps focus at the last slot', () => {
    const r = handleSlotChange(['1', '2', '3', '4', '5', ''], 5, '6');
    expect(r.next).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(r.focusIndex).toBe(OTP_LENGTH - 1);
  });

  it('strips non-digits to empty → treated as delete', () => {
    const start = ['1', '2', '', '', '', ''] as const;
    const r = handleSlotChange(start, 1, 'a');
    expect(r.next).toEqual(['1', '', '', '', '', '']);
    expect(r.focusIndex).toBe(1);
  });
});

describe('handleSlotChange — paste (multi-char)', () => {
  it('spreads a 6-digit paste from box 0', () => {
    const r = handleSlotChange(emptyOtp(), 0, '123456');
    expect(r.next).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(r.focusIndex).toBe(OTP_LENGTH - 1);
  });

  it('spreads a paste starting at box 2', () => {
    const r = handleSlotChange(['9', '8', '', '', '', ''], 2, '7654');
    expect(r.next).toEqual(['9', '8', '7', '6', '5', '4']);
    expect(r.focusIndex).toBe(OTP_LENGTH - 1);
  });

  it('truncates an overlong paste', () => {
    const r = handleSlotChange(emptyOtp(), 0, '1234567890');
    expect(r.next).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('strips non-digits before spreading', () => {
    const r = handleSlotChange(emptyOtp(), 0, '1-2-3-4-5-6');
    expect(r.next).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});

describe('handleSlotChange — clear (delete)', () => {
  it('returns null-equivalent (empty slot + focus stays)', () => {
    const r = handleSlotChange(['1', '2', '3', '', '', ''], 1, '');
    expect(r.next).toEqual(['1', '', '3', '', '', '']);
    expect(r.focusIndex).toBe(1);
  });
});

describe('handleBackspace', () => {
  it('no-op at index 0', () => {
    expect(handleBackspace(emptyOtp(), 0)).toBeNull();
  });

  it('no-op when current slot is non-empty (RN delete will handle the box itself)', () => {
    expect(handleBackspace(['1', '2', '3', '', '', ''], 2)).toBeNull();
  });

  it('clears the left neighbor and retreats focus when current is empty', () => {
    const r = handleBackspace(['1', '2', '', '', '', ''], 2);
    expect(r).not.toBeNull();
    expect(r!.next).toEqual(['1', '', '', '', '', '']);
    expect(r!.focusIndex).toBe(1);
  });

  it('backspace at the last slot clears slot 4 when slot 5 is empty', () => {
    const r = handleBackspace(['1', '2', '3', '4', '5', ''], 5);
    expect(r).not.toBeNull();
    expect(r!.next).toEqual(['1', '2', '3', '4', '', '']);
    expect(r!.focusIndex).toBe(4);
  });
});
