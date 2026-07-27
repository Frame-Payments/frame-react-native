import { isNumericKeyboard } from '../primitives/keyboardAccessoryLogic';

// isNumericKeyboard decides which inputs get the Done bar. Getting it wrong is
// invisible in a simulator (the hardware keyboard always has a return key) and
// only strands users on a physical device, so the mapping is pinned here.

describe('isNumericKeyboard', () => {
  it.each(['number-pad', 'numeric', 'decimal-pad', 'phone-pad'])(
    'is true for %s, which renders without a return key',
    (kind) => {
      expect(isNumericKeyboard(kind as never)).toBe(true);
    },
  );

  it.each(['default', 'email-address', 'url', 'ascii-capable', 'web-search'])(
    'is false for %s, which already has a return key',
    (kind) => {
      expect(isNumericKeyboard(kind as never)).toBe(false);
    },
  );

  it('is false when keyboardType is unset', () => {
    // ValidatedTextField defaults to 'default', but raw TextInputs may omit it
    // entirely — an absent type must not attach the accessory.
    expect(isNumericKeyboard(undefined)).toBe(false);
  });
});
