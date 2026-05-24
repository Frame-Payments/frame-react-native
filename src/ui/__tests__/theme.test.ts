import {
  darkColors,
  defaultFonts,
  defaultRadii,
  fontLineHeights,
  fontWeights,
  lightColors,
  resolveTheme,
} from '../theme/defaults';

describe('color tokens (mirror Android values{,-night}/colors.xml)', () => {
  it('light primaryButton matches Android frame_primary_button', () => {
    expect(lightColors.primaryButton).toBe('#324D52');
    expect(darkColors.primaryButton).toBe('#506F8A');
  });

  it('light surface is white, dark surface is system dark', () => {
    expect(lightColors.surface).toBe('#FFFFFF');
    expect(darkColors.surface).toBe('#1C1C1E');
  });

  it('strokes carry alpha (RRGGBBAA) — light ~20% black, dark ~20% white', () => {
    expect(lightColors.surfaceStroke).toBe('#00000033');
    expect(darkColors.surfaceStroke).toBe('#FFFFFF33');
    expect(lightColors.disabledButtonStroke).toBe('#00000033');
    expect(darkColors.disabledButtonStroke).toBe('#FFFFFF33');
  });

  it('error / toast match Material 3 dark error palette', () => {
    expect(lightColors.error).toBe('#B00020');
    expect(darkColors.error).toBe('#CF6679');
    expect(lightColors.toastBackground).toBe('#B00020');
    expect(darkColors.toastBackground).toBe('#CF6679');
    expect(darkColors.toastText).toBe('#000000');
    expect(lightColors.toastText).toBe('#FFFFFF');
  });

  it('secondary button background is transparent on both schemes', () => {
    expect(lightColors.secondaryButton).toBe('#00000000');
    expect(darkColors.secondaryButton).toBe('#00000000');
  });

  it('onboarding progress is white-on-brand on both schemes', () => {
    expect(lightColors.onboardingProgressFilledOnBrand).toBe('#FFFFFF');
    expect(darkColors.onboardingProgressFilledOnBrand).toBe('#FFFFFF');
    expect(lightColors.onboardingProgressEmptyOnBrand).toBe('#FFFFFF66');
    expect(darkColors.onboardingProgressEmptyOnBrand).toBe('#FFFFFF66');
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

describe('font tokens (Material 3 sizes + Frame weight overrides)', () => {
  it('title/heading/headline get explicit weights to match iOS SwiftUI defaults', () => {
    expect(fontWeights.title).toBe('700');
    expect(fontWeights.heading).toBe('600');
    expect(fontWeights.headline).toBe('600');
    expect(fontWeights.label).toBe('600');
    expect(fontWeights.button).toBe('600');
  });

  it('body / bodySmall / caption stay at regular weight', () => {
    expect(fontWeights.body).toBe('400');
    expect(fontWeights.bodySmall).toBe('400');
    expect(fontWeights.caption).toBe('400');
  });

  it('sizes match the shipping defaults', () => {
    // Frame iOS uses dynamic system tokens (.title, .headline, etc.); RN
    // ships concrete pt sizes that visually align with those defaults on
    // the iPhone reference size class. Keep these in sync with
    // src/ui/theme/defaults.ts.
    expect(defaultFonts.title.size).toBe(24);
    expect(defaultFonts.heading.size).toBe(24);
    expect(defaultFonts.headline.size).toBe(18);
    expect(defaultFonts.body.size).toBe(14);
    expect(defaultFonts.bodySmall.size).toBe(12);
    expect(defaultFonts.label.size).toBe(14);
    expect(defaultFonts.caption.size).toBe(11);
    expect(defaultFonts.button.size).toBe(14);
  });

  it('line heights pair with sizes', () => {
    expect(fontLineHeights.title).toBe(40);
    expect(fontLineHeights.heading).toBe(36);
    expect(fontLineHeights.headline).toBe(28);
    expect(fontLineHeights.body).toBe(24);
    expect(fontLineHeights.caption).toBe(16);
  });

  it('all font tokens default to "system"', () => {
    for (const token of Object.values(defaultFonts)) {
      expect(token.name).toBe('system');
    }
  });
});

describe('radii', () => {
  it('matches FrameRadii defaults (8 / 10 / 16)', () => {
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
