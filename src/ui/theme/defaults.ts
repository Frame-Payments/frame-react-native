import type {
  FrameTheme,
  FrameThemeColors,
  FrameThemeFonts,
  FrameThemeRadii,
} from '../../types';

/**
 * The active device color scheme. Passed to {@link resolveTheme} by
 * {@link FrameProvider} and derived from `Appearance.getColorScheme()`.
 */
export type ColorScheme = 'light' | 'dark';

// Every value below is iOS's actual default, not a from-scratch RN choice —
// pulled from Sources/Frame/Theming/FrameTheme.swift's Colors.init defaults
// and the Colors.xcassets color sets those named assets resolve to
// (Sources/Frame/Resources/Colors.xcassets/*.colorset/Contents.json), so a
// host that never overrides the theme renders visually identically on both
// platforms.
//
// Two slots resolve to plain SwiftUI system colors rather than a named asset:
//   - secondaryButton = Color(.systemBackground) — Apple's semantic window
//     background, opaque white in light mode and opaque black in dark mode
//     (NOT the same as RN's previous fully-transparent default).
//   - error / toastBackground = .red (SwiftUI's systemRed) — Apple's
//     documented HIG system-red hex values (#FF3B30 light / #FF453A dark).
export const lightColors: Required<FrameThemeColors> = {
  primaryButton: '#2B4146',
  primaryButtonText: '#FFFFFF',
  secondaryButton: '#FFFFFF',
  secondaryButtonText: '#2B4146',
  disabledButton: '#F7F7F7',
  disabledButtonStroke: '#D9D9D9',
  disabledButtonText: '#6F6F6F',
  surface: '#FFFFFF',
  surfaceStroke: '#C7C7C7',
  textPrimary: '#000000',
  textSecondary: '#2A2E2E99',
  error: '#FF3B30',
  toastBackground: '#FF3B30',
  toastText: '#FFFFFF',
  onboardingHeaderBackground: '#FCFBF8',
  onboardingProgressFilledOnBrand: '#FFFFFF',
  onboardingProgressEmptyOnBrand: '#FFFFFF40',
};

export const darkColors: Required<FrameThemeColors> = {
  primaryButton: '#50787F',
  primaryButtonText: '#FFFFFF',
  secondaryButton: '#000000',
  secondaryButtonText: '#50787F',
  disabledButton: '#2E2E2E',
  disabledButtonStroke: '#545454',
  disabledButtonText: '#AEAEAE',
  surface: '#1C1C1E',
  surfaceStroke: '#575759',
  textPrimary: '#FFFFFF',
  textSecondary: '#EBEBEBB2',
  error: '#FF453A',
  toastBackground: '#FF453A',
  toastText: '#FFFFFF',
  onboardingHeaderBackground: '#1F2D33',
  onboardingProgressFilledOnBrand: '#FFFFFF',
  onboardingProgressEmptyOnBrand: '#FFFFFF40',
};

// Point sizes match iOS's Dynamic Type styles at their default ("Large")
// content-size category (Sources/Frame/Theming/FrameTheme.swift's Fonts.init:
// title=.title(28), headline/button=.headline(17 semibold), body=.body(17),
// label=.subheadline(15), caption=.caption(12)). `heading` (18, semibold) and
// `bodySmall` (14) are iOS's own explicit `.system(size:weight:)` overrides,
// not named styles, so there's no separate Dynamic Type constant to match —
// their point sizes are copied directly from those two `.system(size:)` calls.
//
// RN has no OS-level Dynamic Type scaling to inherit these from, so these are
// fixed sizes rather than a live accessibility-driven scale, same as before.
export const defaultFonts: Required<FrameThemeFonts> = {
  title: { name: 'system', size: 28 },
  heading: { name: 'system', size: 18 },
  headline: { name: 'system', size: 17 },
  body: { name: 'system', size: 17 },
  bodySmall: { name: 'system', size: 14 },
  label: { name: 'system', size: 15 },
  caption: { name: 'system', size: 12 },
  button: { name: 'system', size: 17 },
};

export const fontWeights = {
  title: '400',
  heading: '600',
  headline: '600',
  body: '400',
  bodySmall: '400',
  label: '400',
  caption: '400',
  button: '600',
} as const;

// Apple's documented Dynamic Type line heights at the default size category,
// for the slots backed by a named text style (title/headline/body/label/
// caption/button — button uses .headline's line height too, matching its font).
// `heading` and `bodySmall` have no named style to read a line height from
// (see the size comment above), so they use the same ~1.3x ratio the other
// slots' size:line-height pairs approximate.
export const fontLineHeights = {
  title: 34,
  heading: 23,
  headline: 22,
  body: 22,
  bodySmall: 18,
  label: 20,
  caption: 16,
  button: 22,
} as const;

export const defaultRadii: Required<FrameThemeRadii> = {
  small: 8,
  medium: 10,
  large: 16,
};

/**
 * Fully resolved theme with no optional fields — returned by {@link resolveTheme}
 * and exposed to components via {@link useFrameTheme}. Every color, font, radius,
 * weight, and line-height is guaranteed to be present.
 */
export interface ResolvedFrameTheme {
  /** All color slots resolved against the current scheme and any override. */
  colors: Required<FrameThemeColors>;
  /** All font slots resolved against defaults and any override. */
  fonts: Required<FrameThemeFonts>;
  /** All radius slots resolved against defaults and any override. */
  radii: Required<FrameThemeRadii>;
  /** Font-weight map used by Frame text components. */
  fontWeights: typeof fontWeights;
  /** Line-height map used by Frame text components. */
  fontLineHeights: typeof fontLineHeights;
}

/**
 * Merges scheme defaults with an optional {@link FrameTheme} override and
 * returns a fully resolved theme. Called by {@link FrameProvider} on every
 * scheme or theme change.
 *
 * @param scheme - `'light'` or `'dark'` — selects the base color palette.
 * @param override - Optional partial theme merged on top of the scheme defaults.
 * @returns A {@link ResolvedFrameTheme} with all fields populated.
 */
export function resolveTheme(scheme: ColorScheme, override?: FrameTheme): ResolvedFrameTheme {
  const baseColors = scheme === 'dark' ? darkColors : lightColors;
  return {
    colors: { ...baseColors, ...(override?.colors ?? {}) },
    fonts: { ...defaultFonts, ...(override?.fonts ?? {}) },
    radii: { ...defaultRadii, ...(override?.radii ?? {}) },
    fontWeights,
    fontLineHeights,
  };
}
