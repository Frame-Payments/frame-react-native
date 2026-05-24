import type {
  FrameTheme,
  FrameThemeColors,
  FrameThemeFonts,
  FrameThemeRadii,
} from '../../types';

export type ColorScheme = 'light' | 'dark';

export const lightColors: Required<FrameThemeColors> = {
  primaryButton: '#324D52',
  primaryButtonText: '#FFFFFF',
  secondaryButton: '#00000000',
  secondaryButtonText: '#324D52',
  disabledButton: '#324D5259',
  disabledButtonStroke: '#00000033',
  disabledButtonText: '#FFFFFFB3',
  surface: '#FFFFFF',
  surfaceStroke: '#00000033',
  textPrimary: '#000000',
  textSecondary: '#6B7280',
  error: '#B00020',
  toastBackground: '#B00020',
  toastText: '#FFFFFF',
  onboardingHeaderBackground: '#324D52',
  onboardingProgressFilledOnBrand: '#FFFFFF',
  onboardingProgressEmptyOnBrand: '#FFFFFF66',
};

export const darkColors: Required<FrameThemeColors> = {
  primaryButton: '#506F8A',
  primaryButtonText: '#FFFFFF',
  secondaryButton: '#00000000',
  secondaryButtonText: '#8FB3CC',
  disabledButton: '#506F8A59',
  disabledButtonStroke: '#FFFFFF33',
  disabledButtonText: '#FFFFFFB3',
  surface: '#1C1C1E',
  surfaceStroke: '#FFFFFF33',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  error: '#CF6679',
  toastBackground: '#CF6679',
  toastText: '#000000',
  onboardingHeaderBackground: '#1F2D33',
  onboardingProgressFilledOnBrand: '#FFFFFF',
  onboardingProgressEmptyOnBrand: '#FFFFFF66',
};

export const defaultFonts: Required<FrameThemeFonts> = {
  title: { name: 'system', size: 24 },
  heading: { name: 'system', size: 24 },
  headline: { name: 'system', size: 18 },
  body: { name: 'system', size: 14 },
  bodySmall: { name: 'system', size: 12 },
  label: { name: 'system', size: 14 },
  caption: { name: 'system', size: 11 },
  button: { name: 'system', size: 14 },
};

export const fontWeights = {
  title: '700',
  heading: '600',
  headline: '600',
  body: '400',
  bodySmall: '400',
  label: '600',
  caption: '400',
  button: '600',
} as const;

export const fontLineHeights = {
  title: 40,
  heading: 36,
  headline: 28,
  body: 24,
  bodySmall: 20,
  label: 20,
  caption: 16,
  button: 20,
} as const;

export const defaultRadii: Required<FrameThemeRadii> = {
  small: 8,
  medium: 10,
  large: 16,
};

export interface ResolvedFrameTheme {
  colors: Required<FrameThemeColors>;
  fonts: Required<FrameThemeFonts>;
  radii: Required<FrameThemeRadii>;
  fontWeights: typeof fontWeights;
  fontLineHeights: typeof fontLineHeights;
}

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
