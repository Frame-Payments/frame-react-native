import type { ResolvedFrameTheme } from '../theme/defaults';
import type { ButtonVariant } from './Button.types';

export function resolveButtonColors(
  variant: ButtonVariant,
  disabled: boolean,
  theme: ResolvedFrameTheme,
): { background: string; stroke: string; foreground: string } {
  if (disabled) {
    return {
      background: theme.colors.disabledButton,
      stroke: theme.colors.disabledButtonStroke,
      foreground: theme.colors.disabledButtonText,
    };
  }
  if (variant === 'primary') {
    return {
      background: theme.colors.primaryButton,
      stroke: 'transparent',
      foreground: theme.colors.primaryButtonText,
    };
  }
  return {
    background: theme.colors.secondaryButton,
    stroke: theme.colors.secondaryButtonText,
    foreground: theme.colors.secondaryButtonText,
  };
}
