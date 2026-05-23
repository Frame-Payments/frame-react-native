import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';

// One row in the saved-payment-methods list inside Checkout / Onboarding.
// Mirrors iOS FramePaymentMethodRow and Android PaymentMethodRow:
//   - 64pt min height, 12pt vertical padding
//   - icon column (48×32) for the brand glyph (host owns the icon node)
//   - title line "Visa •••• 4242" / "ACH •••• 1234"
//   - subtitle line "Exp 12/29" / "Checking"
//   - radio selector on the right; selected state outlines the whole row

export interface PaymentMethodRowProps {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}

const ROW_MIN_HEIGHT = 64;
const ICON_WIDTH = 48;
const ICON_HEIGHT = 32;
const RADIO_SIZE = 22;

export function PaymentMethodRow({
  title,
  subtitle,
  selected,
  onPress,
  icon,
  testID,
  accessibilityLabel,
}: PaymentMethodRowProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const borderColor = selected ? theme.colors.textPrimary : theme.colors.surfaceStroke;
  const borderWidth = selected ? 2 : StyleSheet.hairlineWidth;
  // When the border thickens on selection, content shifts 1pt right/down. Pad
  // the inset to keep visual height + alignment constant across both states.
  const innerPadding = selected ? 11 : 12;

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor,
          borderWidth,
          borderRadius: theme.radii.medium,
          paddingHorizontal: innerPadding,
          paddingVertical: innerPadding,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.iconColumn}>{icon ?? null}</View>
      <View style={styles.textColumn}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.body.size,
            fontWeight: theme.fontWeights.body,
            lineHeight: theme.fontLineHeights.body,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.fonts.bodySmall.size,
              fontWeight: theme.fontWeights.bodySmall,
              lineHeight: theme.fontLineHeights.bodySmall,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.radioOuter,
          { borderColor: selected ? theme.colors.textPrimary : theme.colors.surfaceStroke },
        ]}
      >
        {selected ? <View style={[styles.radioInner, { backgroundColor: theme.colors.textPrimary }]} /> : null}
      </View>
    </Pressable>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: ROW_MIN_HEIGHT,
      gap: 12,
    },
    iconColumn: {
      width: ICON_WIDTH,
      height: ICON_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textColumn: {
      flex: 1,
      justifyContent: 'center',
    },
    radioOuter: {
      width: RADIO_SIZE,
      height: RADIO_SIZE,
      borderRadius: RADIO_SIZE / 2,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: RADIO_SIZE / 2,
      height: RADIO_SIZE / 2,
      borderRadius: RADIO_SIZE / 4,
    },
  });
}
