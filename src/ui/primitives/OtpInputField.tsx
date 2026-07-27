import { useEffect, useMemo, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import {
  OTP_LENGTH,
  fromString,
  handleBackspace,
  handleSlotChange,
  toString,
} from './otpFieldLogic';

// 6-box OTP input with auto-advance, Backspace-retreats, paste-spreads. The
// reducer owns the value as a string; this component splits and reconstitutes
// per render. Each box is a 1-char TextInput; pasting multi-digit content
// into any box spreads across the remaining boxes (handled in
// otpFieldLogic.handleSlotChange).

export interface OtpInputFieldProps {
  value: string;
  onChange: (next: string) => void;
  /** When true, all boxes become focusable but read-only. Used while the
   * remote OTP confirm call is in flight. */
  disabled?: boolean;
  /** Auto-focus the first box on mount. */
  autoFocusOnMount?: boolean;
  testID?: string;
}

export function OtpInputField({
  value,
  onChange,
  disabled,
  autoFocusOnMount = true,
  testID,
}: OtpInputFieldProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const slots = fromString(value);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (!autoFocusOnMount) return undefined;
    // Defer to the frame after layout so the modal's slide-in animation can
    // finish before we steal focus. Double-RAF works across iOS and Android
    // without a magic-number setTimeout that drops frames on slower devices.
    let rafA: number | null = null;
    let rafB: number | null = null;
    rafA = requestAnimationFrame(() => {
      rafB = requestAnimationFrame(() => {
        inputs.current[0]?.focus();
      });
    });
    return () => {
      if (rafA !== null) cancelAnimationFrame(rafA);
      if (rafB !== null) cancelAnimationFrame(rafB);
    };
  }, [autoFocusOnMount]);

  function focusAt(index: number) {
    if (index < 0 || index >= OTP_LENGTH) return;
    inputs.current[index]?.focus();
  }

  function onSlotChange(index: number, raw: string) {
    const update = handleSlotChange(slots, index, raw);
    onChange(toString(update.next));
    if (update.focusIndex !== index) {
      // Run after the state update has settled to avoid focus-fighting on iOS.
      requestAnimationFrame(() => focusAt(update.focusIndex));
    }
  }

  function onSlotKeyPress(index: number, event: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (event.nativeEvent.key !== 'Backspace') return;
    const update = handleBackspace(slots, index);
    if (update) {
      onChange(toString(update.next));
      requestAnimationFrame(() => focusAt(update.focusIndex));
    }
  }

  return (
    <View style={styles.row} testID={testID}>
      {Array.from({ length: OTP_LENGTH }).map((_, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            inputs.current[index] = ref;
          }}
          value={slots[index] ?? ''}
          onChangeText={(raw) => onSlotChange(index, raw)}
          onKeyPress={(event) => onSlotKeyPress(index, event)}
          editable={!disabled}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete={Platform.OS === 'ios' ? 'one-time-code' : 'sms-otp'}
          textContentType="oneTimeCode"
          // RN limits maxLength to the slot, but iOS autofill from SMS sends
          // the full 6-digit code into the focused field — handleSlotChange
          // spreads the paste across the remaining slots.
          maxLength={OTP_LENGTH}
          selectTextOnFocus
          style={[
            styles.slot,
            {
              borderColor: theme.colors.surfaceStroke,
              borderRadius: theme.radii.medium,
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.heading.size,
              fontWeight: theme.fontWeights.heading,
            },
          ]}
          accessibilityLabel={`Code digit ${index + 1}`}
          testID={testID ? `${testID}.${index}` : undefined}
        />
      ))}
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
    },
    slot: {
      flex: 1,
      height: 56,
      borderWidth: 1,
      textAlign: 'center',
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
  });
}
