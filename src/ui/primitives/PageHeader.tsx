import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { Icon } from '../assets';

// Onboarding screen header: back button (or invisible spacer) + centered title
// + matching spacer on the right. Sits below the modal's BottomSheet chrome.

export interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  testID?: string;
}

const BACK_WIDTH = 44;

export function PageHeader({ title, onBack, testID }: PageHeaderProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
          >
            <Icon name="left-chevron" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
      <Text
        style={[
          styles.title,
          {
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.headline.size,
            fontWeight: theme.fontWeights.headline,
            lineHeight: theme.fontLineHeights.headline,
          },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={styles.side} />
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    side: {
      width: BACK_WIDTH,
      alignItems: 'center',
    },
    back: {
      width: BACK_WIDTH,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backGlyph: {
      fontSize: 28,
      fontWeight: '300',
      includeFontPadding: false,
    },
    title: {
      flex: 1,
      textAlign: 'center',
    },
  });
}
