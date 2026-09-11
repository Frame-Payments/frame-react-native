import {
  darkColors,
  defaultFonts,
  defaultRadii,
  fontLineHeights,
  fontWeights,
  lightColors,
  resolveTheme,
} from '../theme/defaults';

describe('color tokens (mirror Frame-iOS Colors.xcassets + system colors)', () => {
  it('primaryButton matches MainButtonColor.colorset', () => {
    expect(lightColors.primaryButton).toBe('#2B4146');
    expect(darkColors.primaryButton).toBe('#50787F');
  });

  it('surface matches SurfaceColor.colorset', () => {
    expect(lightColors.surface).toBe('#FFFFFF');
    expect(darkColors.surface).toBe('#1C1C1E');
  });

  it('surfaceStroke matches SurfaceStrokeColor.colorset', () => {
    expect(lightColors.surfaceStroke).toBe('#C7C7C7');
    expect(darkColors.surfaceStroke).toBe('#575759');
  });

  it('disabled-button trio matches UnfilledButton*.colorset', () => {
    expect(lightColors.disabledButton).toBe('#F7F7F7');
    expect(darkColors.disabledButton).toBe('#2E2E2E');
    expect(lightColors.disabledButtonStroke).toBe('#D9D9D9');
    expect(darkColors.disabledButtonStroke).toBe('#545454');
    expect(lightColors.disabledButtonText).toBe('#6F6F6F');
    expect(darkColors.disabledButtonText).toBe('#AEAEAE');
  });

  it('text colors match PrimaryTextColor / TextColorSecondary colorsets', () => {
    expect(lightColors.textPrimary).toBe('#000000');
    expect(darkColors.textPrimary).toBe('#FFFFFF');
    expect(lightColors.textSecondary).toBe('#2A2E2E99');
    expect(darkColors.textSecondary).toBe('#EBEBEBB2');
  });

  it('error / toastBackground match SwiftUI .red (Apple systemRed)', () => {
    expect(lightColors.error).toBe('#FF3B30');
    expect(darkColors.error).toBe('#FF453A');
    expect(lightColors.toastBackground).toBe('#FF3B30');
    expect(darkColors.toastBackground).toBe('#FF453A');
    expect(lightColors.toastText).toBe('#FFFFFF');
    expect(darkColors.toastText).toBe('#FFFFFF');
  });

  it('secondaryButton matches Color(.systemBackground) — opaque, not transparent', () => {
    expect(lightColors.secondaryButton).toBe('#FFFFFF');
    expect(darkColors.secondaryButton).toBe('#000000');
  });

  it('secondaryButtonText reuses primaryButton\'s color, matching iOS', () => {
    expect(lightColors.secondaryButtonText).toBe(lightColors.primaryButton);
    expect(darkColors.secondaryButtonText).toBe(darkColors.primaryButton);
  });

  it('onboardingHeaderBackground matches OnboardingHeaderBackground.colorset', () => {
    expect(lightColors.onboardingHeaderBackground).toBe('#FCFBF8');
    expect(darkColors.onboardingHeaderBackground).toBe('#1F2D33');
  });

  it('onboarding progress indicator matches .white / .white.opacity(0.25) on both schemes', () => {
    expect(lightColors.onboardingProgressFilledOnBrand).toBe('#FFFFFF');
    expect(darkColors.onboardingProgressFilledOnBrand).toBe('#FFFFFF');
    expect(lightColors.onboardingProgressEmptyOnBrand).toBe('#FFFFFF40');
    expect(darkColors.onboardingProgressEmptyOnBrand).toBe('#FFFFFF40');
  });

  it('every public token is set on both schemes', () => {
    const lightKeys = Object.keys(lightColors).sort();
    const darkKeys = Object.keys(darkColors).sort();
    expect(lightKeys).toEqual(darkKeys);
    expect(lightKeys).toEqual(
      [
        'disabledButton',
        'disabledButtonStroke',
        'disabledButtonText',
        'error',
        'onboardingHeaderBackground',
        'onboardingProgressEmptyOnBrand',
        'onboardingProgressFilledOnBrand',
        'primaryButton',
        'primaryButtonText',
        'secondaryButton',
        'secondaryButtonText',
        'surface',
        'surfaceStroke',
        'textPrimary',
        'textSecondary',
        'toastBackground',
        'toastText',
      ].sort(),
    );
  });
});

describe('font tokens (mirror Frame-iOS Fonts.init Dynamic Type defaults)', () => {
  it('headline / button / heading get semibold weight, matching iOS', () => {
    expect(fontWeights.headline).toBe('600');
    expect(fontWeights.button).toBe('600');
    expect(fontWeights.heading).toBe('600');
  });

  it('title / body / bodySmall / label / caption stay at regular weight', () => {
    expect(fontWeights.title).toBe('400');
    expect(fontWeights.body).toBe('400');
    expect(fontWeights.bodySmall).toBe('400');
    expect(fontWeights.label).toBe('400');
    expect(fontWeights.caption).toBe('400');
  });

  it('sizes match iOS Dynamic Type point sizes at the default content-size category', () => {
    expect(defaultFonts.title.size).toBe(28);
    expect(defaultFonts.heading.size).toBe(18);
    expect(defaultFonts.headline.size).toBe(17);
    expect(defaultFonts.body.size).toBe(17);
    expect(defaultFonts.bodySmall.size).toBe(14);
    expect(defaultFonts.label.size).toBe(15);
    expect(defaultFonts.caption.size).toBe(12);
    expect(defaultFonts.button.size).toBe(17);
  });

  it('line heights pair with sizes', () => {
    expect(fontLineHeights.title).toBe(34);
    expect(fontLineHeights.headline).toBe(22);
    expect(fontLineHeights.body).toBe(22);
    expect(fontLineHeights.label).toBe(20);
    expect(fontLineHeights.caption).toBe(16);
    expect(fontLineHeights.button).toBe(22);
  });

  it('all font tokens default to "system"', () => {
    for (const token of Object.values(defaultFonts)) {
      expect(token.name).toBe('system');
    }
  });
});

describe('radii', () => {
  it('matches FrameTheme.Radii defaults (8 / 10 / 16)', () => {
    expect(defaultRadii.small).toBe(8);
    expect(defaultRadii.medium).toBe(10);
    expect(defaultRadii.large).toBe(16);
  });
});

describe('resolveTheme', () => {
  it('selects light tokens when scheme is "light"', () => {
    const theme = resolveTheme('light');
    expect(theme.colors.primaryButton).toBe(lightColors.primaryButton);
    expect(theme.colors.surface).toBe(lightColors.surface);
    expect(theme.colors.toastBackground).toBe(lightColors.toastBackground);
    expect(theme.colors.toastText).toBe(lightColors.toastText);
  });

  it('selects dark tokens when scheme is "dark"', () => {
    const theme = resolveTheme('dark');
    expect(theme.colors.primaryButton).toBe(darkColors.primaryButton);
    expect(theme.colors.surface).toBe(darkColors.surface);
    expect(theme.colors.toastBackground).toBe(darkColors.toastBackground);
    expect(theme.colors.toastText).toBe(darkColors.toastText);
  });

  it('merges caller color overrides on top of scheme defaults', () => {
    const theme = resolveTheme('light', { colors: { primaryButton: '#FF0066' } });
    expect(theme.colors.primaryButton).toBe('#FF0066');
    // Non-overridden tokens retain their scheme defaults.
    expect(theme.colors.surface).toBe(lightColors.surface);
    expect(theme.colors.textPrimary).toBe(lightColors.textPrimary);
  });

  it('merges caller font + radii overrides on top of defaults', () => {
    const theme = resolveTheme('light', {
      fonts: { title: { name: 'CustomFont', size: 48 } },
      radii: { medium: 24 },
    });
    expect(theme.colors.primaryButton).toBe(lightColors.primaryButton);
    expect(theme.fonts.title).toEqual({ name: 'CustomFont', size: 48 });
    expect(theme.fonts.body).toEqual(defaultFonts.body);
    expect(theme.radii.medium).toBe(24);
    expect(theme.radii.small).toBe(defaultRadii.small);
  });

  it('caller-supplied toast tokens override scheme defaults', () => {
    const theme = resolveTheme('dark', {
      colors: { toastBackground: '#FF0066', toastText: '#FAFAFA' },
    });
    expect(theme.colors.toastBackground).toBe('#FF0066');
    expect(theme.colors.toastText).toBe('#FAFAFA');
  });

  it('falls back to scheme defaults when caller omits toast tokens', () => {
    const theme = resolveTheme('dark', {
      colors: { primaryButton: '#FF0066' },
    });
    expect(theme.colors.toastBackground).toBe(darkColors.toastBackground);
    expect(theme.colors.toastText).toBe(darkColors.toastText);
  });

  it('always populates fontWeights + fontLineHeights regardless of caller overrides', () => {
    const theme = resolveTheme('light', {
      fonts: { title: { name: 'CustomFont', size: 48 } },
    });
    expect(theme.fontWeights).toBe(fontWeights);
    expect(theme.fontLineHeights).toBe(fontLineHeights);
  });
});
