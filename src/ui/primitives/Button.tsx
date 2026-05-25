import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { resolveButtonColors } from './buttonColors';
import type { ButtonVariant } from './Button.types';

export type { ButtonVariant };
export { resolveButtonColors };

export interface ButtonProps {
  text: string;
  variant?: ButtonVariant;
  enabled?: boolean;
  isLoading?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

const HEIGHT = 50;

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
