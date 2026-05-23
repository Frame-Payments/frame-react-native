import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';

// Capsule-style progress indicator. Renders `total` segments; each one is
// either filled (completed), highlighted (current), or muted (upcoming).
// Used at the top of every onboarding screen.

export interface ProgressBarProps {
  total: number;
  current: number;
  style?: ViewStyle;
}

export function ProgressBar({ total, current, style }: ProgressBarProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (total <= 0) return null;

  return (
    <View style={[styles.row, style]} accessibilityRole="progressbar">
      {Array.from({ length: total }).map((_, index) => {
        const isFilled = index < current;
        const isCurrent = index === current;
        const backgroundColor = isFilled || isCurrent
          ? theme.colors.primaryButton
          : theme.colors.surfaceStroke;
        const opacity = isFilled ? 1 : isCurrent ? 0.85 : 0.5;
        return (
          <View
            key={index}
            style={[styles.cell, { backgroundColor, opacity }]}
            accessibilityLabel={`Step ${index + 1} of ${total}`}
          />
        );
      })}
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    cell: {
      flex: 1,
      height: 5,
      borderRadius: 2.5,
    },
  });
}
