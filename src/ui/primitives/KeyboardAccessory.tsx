import { useMemo } from 'react';
import {
  InputAccessoryView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';

// iOS numeric keyboards (number-pad / phone-pad) have no return key, so a user
// on a physical device has no way to dismiss them — the keyboard sits over the
// screen's primary button with no affordance to close it. iOS's answer is an
// InputAccessoryView: a bar pinned directly above the keyboard. Every numeric
// input in the SDK points at the shared ID below, and each screen renders one
// KeyboardAccessory so the bar exists to attach to.
//
// Android needs none of this — the system back button dismisses the keyboard —
// and InputAccessoryView is iOS-only in RN, so both the ID and the component
// are inert off iOS.

/**
 * Shared `nativeID` linking numeric inputs to the SDK's Done bar. Pass as
 * `inputAccessoryViewID` on a TextInput, and render one {@link KeyboardAccessory}
 * somewhere in the same screen.
 *
 * `undefined` off iOS so the prop is simply absent where it has no meaning.
 */
export const KEYBOARD_ACCESSORY_ID = Platform.OS === 'ios' ? 'frameKeyboardAccessory' : undefined;

export { isNumericKeyboard } from './keyboardAccessoryLogic';

export interface KeyboardAccessoryProps {
  /** Label for the dismiss button. Defaults to "Done". */
  label?: string;
  testID?: string;
}

/**
 * Renders the "Done" bar that iOS pins above the keyboard for inputs carrying
 * {@link KEYBOARD_ACCESSORY_ID}. Renders nothing on Android.
 *
 * Place one per screen that has a numeric input. Rendering it is cheap when no
 * such input is focused — iOS only shows the bar while an input referencing its
 * ID has focus.
 *
 * @example
 * ```tsx
 * <TextInput keyboardType="number-pad" inputAccessoryViewID={KEYBOARD_ACCESSORY_ID} />
 * <KeyboardAccessory />
 * ```
 */
export function KeyboardAccessory({ label = 'Done', testID }: KeyboardAccessoryProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(), []);

  // InputAccessoryView is iOS-only; KEYBOARD_ACCESSORY_ID is undefined
  // elsewhere, and the component would throw without a nativeID.
  if (Platform.OS !== 'ios' || !KEYBOARD_ACCESSORY_ID) return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
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
          style={styles.button}
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
    </InputAccessoryView>
  );
}

function createStyles() {
  return StyleSheet.create({
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
