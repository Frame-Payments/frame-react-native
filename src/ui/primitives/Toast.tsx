import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import {
  subscribeToasts,
  dismissActive,
  type ToastEntry,
} from './toastCenter';

// Renders the active toast at the bottom of the screen, mirroring iOS's
// FrameToast (bottom edge, 16px horizontal margin, 24px from the bottom). Mounted
// exactly once inside FrameProvider, layered above the presenter modal so
// toasts surface over Checkout / Cart / Onboarding.

export function ToastHost() {
  const theme = useFrameTheme();
  const [entry, setEntry] = useState<ToastEntry | null>(null);
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return subscribeToasts(setEntry);
  }, []);

  useEffect(() => {
    if (entry) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [entry, translateY, opacity]);

  if (!entry) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: theme.colors.toastBackground,
            borderRadius: theme.radii.medium,
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <Pressable onPress={dismissActive} accessibilityRole="button" accessibilityLabel="Dismiss notification">
          <Text
            style={{
              color: theme.colors.toastText,
              fontSize: theme.fonts.bodySmall.size,
              fontWeight: theme.fontWeights.bodySmall,
              lineHeight: theme.fontLineHeights.bodySmall,
              textAlign: 'center',
            }}
          >
            {entry.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'stretch',
  },
  toast: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});
