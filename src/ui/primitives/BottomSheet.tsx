import { useMemo, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';

// Visual container for a screen presented via FramePresentationHost. RN's
// outer <Modal presentationStyle="pageSheet" /> gives us the system swipe-down
// chrome on iOS; this primitive supplies the title bar, drag indicator (iOS),
// and close button. On Android there is no drag indicator since the modal is
// fullscreen, so we use only the title bar.

export interface BottomSheetProps {
  title?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
  style?: ViewStyle;
  children: ReactNode;
}

export function BottomSheet({
  title,
  onClose,
  showCloseButton = true,
  style,
  children,
}: BottomSheetProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface }, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerSide}>
          {showCloseButton && onClose ? (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.55 }]}
              hitSlop={8}
            >
              <View style={[styles.closeIcon, { borderColor: theme.colors.textSecondary }]}>
                <Text style={[styles.closeIconText, { color: theme.colors.textSecondary }]}>×</Text>
              </View>
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
          {title ?? ''}
        </Text>
        <View style={styles.headerSide} />
      </View>
      <View style={[styles.divider, { backgroundColor: theme.colors.surfaceStroke }]} />
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const CLOSE_SIZE = 30;

function createStyles(theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      ...Platform.select({
        // pageSheet already supplies rounded top corners + drag indicator on
        // iOS. On Android the modal is fullscreen — no chrome adjustments.
        default: {},
      }),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerSide: {
      width: CLOSE_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      width: CLOSE_SIZE,
      height: CLOSE_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeIcon: {
      width: CLOSE_SIZE,
      height: CLOSE_SIZE,
      borderRadius: CLOSE_SIZE / 2,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeIconText: {
      fontSize: 20,
      fontWeight: '500',
      // Slightly raise the glyph so it visually centers inside the circle.
      marginTop: -2,
      includeFontPadding: false,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
    },
    body: {
      flex: 1,
    },
  });
}
