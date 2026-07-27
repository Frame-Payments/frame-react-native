import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
} from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';

// iOS numeric keyboards (number-pad / phone-pad) have no return key, so a user
// on a physical device has no way to dismiss them — the keyboard sits over the
// screen's primary button with no affordance to close it.
//
// The obvious tool here is iOS's own InputAccessoryView, but it CANNOT be used:
// every SDK screen renders inside <Modal presentationStyle="pageSheet">, which
// is a separate native window on iOS, while InputAccessoryView registers its
// nativeID against the root window. The keyboard inside the modal finds nothing
// to attach to and the bar silently never appears — no error, just nothing.
// (Same native-window trap as ToastHost; see FramePresentationHost.)
//
// So we render our own bar in the React tree instead, absolutely positioned at
// the keyboard's top edge and driven by Keyboard events. That lives inside the
// modal's window, so it actually shows.
//
// Android needs none of this — the system back button dismisses the keyboard.

export interface KeyboardAccessoryProps {
  /** Label for the dismiss button. Defaults to "Done". */
  label?: string;
  testID?: string;
}

/**
 * A "Done" bar pinned to the top edge of the on-screen keyboard, giving numeric
 * keyboards (which have no return key) a way to be dismissed.
 *
 * Renders only while the keyboard is up, and only on iOS — Android's back
 * button already dismisses. Mounted once in {@link BottomSheet}, so every
 * presented SDK screen gets it without per-screen wiring.
 */
export function KeyboardAccessory({ label = 'Done', testID }: KeyboardAccessoryProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(), []);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    // `Will` events fire in step with the keyboard's animation, so the bar
    // travels with it instead of snapping into place after it lands. iOS-only,
    // which is fine — this whole component is iOS-only.
    const onShow = (event: KeyboardEvent) => setKeyboardHeight(event.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener('keyboardWillShow', onShow);
    const changeSub = Keyboard.addListener('keyboardWillChangeFrame', onShow);
    const hideSub = Keyboard.addListener('keyboardWillHide', onHide);
    return () => {
      showSub.remove();
      changeSub.remove();
      hideSub.remove();
    };
  }, []);

  if (Platform.OS !== 'ios' || keyboardHeight === 0) return null;

  return (
    <View
      // pointerEvents="box-none" so the bar itself is tappable but the empty
      // area around it doesn't swallow touches meant for the screen below.
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: keyboardHeight }]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.surfaceStroke,
          },
        ]}
      >
        <Pressable
          // Dismisses via blur rather than Keyboard.dismiss() so the focused
          // field fires its normal blur handlers (validation, formatting).
          onPress={() => TextInput.State.currentlyFocusedInput()?.blur()}
          accessibilityRole="button"
          accessibilityLabel={label}
          hitSlop={8}
          testID={testID}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.55 }]}
        >
          <Text
            style={{
              color: theme.colors.primaryButton,
              fontSize: theme.fonts.body.size,
              fontWeight: theme.fontWeights.heading,
            }}
          >
            {label}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      // Above the screen's own content (including sticky footers) so the bar is
      // never clipped by a sibling rendered later in the tree.
      zIndex: 10,
    },
    bar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    button: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
  });
}
