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
import { Icon } from '../assets';

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
              <Icon name="close-circle" size={CLOSE_SIZE} color={theme.colors.textPrimary} />
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

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
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
    divider: {
      height: StyleSheet.hairlineWidth,
    },
    body: {
      flex: 1,
    },
  });
}
