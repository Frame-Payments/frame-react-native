import { resolveButtonColors } from '../primitives/buttonColors';
import { resolveTheme } from '../theme/defaults';

const light = resolveTheme('light');
const dark = resolveTheme('dark');

describe('resolveButtonColors — primary enabled', () => {
  it('uses primaryButton / primaryButtonText on light', () => {
    expect(resolveButtonColors('primary', false, light)).toEqual({
      background: light.colors.primaryButton,
      stroke: 'transparent',
      foreground: light.colors.primaryButtonText,
    });
  });

  it('uses primaryButton / primaryButtonText on dark', () => {
    expect(resolveButtonColors('primary', false, dark)).toEqual({
      background: dark.colors.primaryButton,
      stroke: 'transparent',
      foreground: dark.colors.primaryButtonText,
    });
  });
});

describe('resolveButtonColors — secondary enabled', () => {
  it('uses secondary background + secondaryButtonText for stroke and foreground', () => {
    expect(resolveButtonColors('secondary', false, light)).toEqual({
      background: light.colors.secondaryButton,
      stroke: light.colors.secondaryButtonText,
      foreground: light.colors.secondaryButtonText,
    });
  });
});

describe('resolveButtonColors — disabled', () => {
  it('uses disabled tokens regardless of variant (regression for H2)', () => {
    const expected = {
      background: light.colors.disabledButton,
      stroke: light.colors.disabledButtonStroke,
      foreground: light.colors.disabledButtonText,
    };
    expect(resolveButtonColors('primary', true, light)).toEqual(expected);
    expect(resolveButtonColors('secondary', true, light)).toEqual(expected);
  });

  it('applies dark disabled tokens on the dark scheme', () => {
    expect(resolveButtonColors('primary', true, dark)).toEqual({
      background: dark.colors.disabledButton,
      stroke: dark.colors.disabledButtonStroke,
      foreground: dark.colors.disabledButtonText,
    });
  });
});
