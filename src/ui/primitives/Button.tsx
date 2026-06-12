import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { resolveButtonColors } from './buttonColors';
import type { ButtonVariant } from './Button.types';

export type { ButtonVariant };
export { resolveButtonColors };

/**
 * Props for the {@link Button} component.
 */
export interface ButtonProps {
  /** Label text displayed inside the button. Also used as the default accessibility label. */
  text: string;
  /** Visual variant. Defaults to `'primary'`. */
  variant?: ButtonVariant;
  /** When `false`, renders the button in a disabled/greyed state and ignores presses. Defaults to `true`. */
  enabled?: boolean;
  /** When `true`, replaces the label with an `ActivityIndicator` and disables presses. Defaults to `false`. */
  isLoading?: boolean;
  /** Called when the button is tapped (ignored while disabled or loading). */
  onPress: () => void;
  /** Additional `ViewStyle` merged onto the outer container. */
  style?: ViewStyle;
  /** Value passed to `testID` for test selectors. */
  testID?: string;
  /** Screen-reader label. Defaults to `text`. */
  accessibilityLabel?: string;
}

const HEIGHT = 50;

/**
 * A themed action button that follows the Frame design system. Supports
 * primary and secondary variants, a loading state (spinner replaces label),
 * and automatic disabled styling.
 *
 * Requires a {@link FrameProvider} ancestor to supply the active theme.
 *
 * @param props - {@link ButtonProps}
 *
 * @example
 * ```tsx
 * <Button text="Pay now" onPress={handlePay} />
 * <Button text="Cancel" variant="secondary" onPress={handleCancel} />
 * ```
 */
export function Button({
  text,
  variant = 'primary',
  enabled = true,
  isLoading = false,
  onPress,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useFrameTheme();
  const disabled = !enabled || isLoading;
  const { background, stroke, foreground } = resolveButtonColors(variant, disabled, theme);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? text}
      accessibilityState={{ disabled, busy: isLoading }}
      style={[
        styles.base,
        {
          backgroundColor: background,
          borderColor: stroke,
          borderWidth: stroke === 'transparent' ? 0 : 1,
          borderRadius: theme.radii.medium,
        },
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text
          style={{
            color: foreground,
            fontSize: theme.fonts.button.size,
            fontWeight: theme.fontWeights.button,
            lineHeight: theme.fontLineHeights.button,
          }}
        >
          {text}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: HEIGHT,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
