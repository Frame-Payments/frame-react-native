import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';

// Simple square checkbox + label. Matches iOSCheckboxToggleStyle from
// Frame iOS: 22pt square with a thin border, filled with the brand color
// when checked.

export interface CheckboxProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

const BOX_SIZE = 22;

export function Checkbox({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: CheckboxProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      disabled={disabled}
      style={({ pressed }) => [styles.row, style, pressed && !disabled ? { opacity: 0.7 } : null]}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: value ? theme.colors.primaryButton : theme.colors.surfaceStroke,
            backgroundColor: value ? theme.colors.primaryButton : 'transparent',
            borderRadius: theme.radii.small / 2,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {value ? <Text style={[styles.check, { color: theme.colors.primaryButtonText }]}>✓</Text> : null}
      </View>
      {label != null ? <View style={styles.labelWrap}>{typeof label === 'string' ? (
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.body.size,
            lineHeight: theme.fontLineHeights.body,
          }}
        >
          {label}
        </Text>
      ) : label}</View> : null}
    </Pressable>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    box: {
      width: BOX_SIZE,
      height: BOX_SIZE,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    check: {
      fontSize: 14,
      fontWeight: '700',
      includeFontPadding: false,
      lineHeight: 16,
    },
    labelWrap: {
      flex: 1,
    },
  });
}
