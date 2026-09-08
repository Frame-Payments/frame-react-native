import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import {
  applyInputRestriction,
  truncateToLimit,
  type TextFieldInputRestriction,
} from './textFieldUtils';

export { truncateToLimit, applyInputRestriction };
export type { TextFieldInputRestriction };

/**
 * Props for the {@link ValidatedTextField} component.
 */
export interface ValidatedTextFieldProps {
  prompt: string;
  value: string;
  onChangeText: (next: string) => void;
  /**
   * Optional error string. When set, displayed below the field (or to the
   * right of it when `inlineError` is true) and announced to screen readers.
   */
  error?: string | null;
  /**
   * Pair with `error` to enable auto-clear on keystroke. If you manage the
   * error externally without a clear callback, omit this and clear it yourself.
   */
  onErrorChange?: (next: string | null) => void;
  keyboardType?: KeyboardTypeOptions;
  /**
   * Enables the platform's autofill / QuickType suggestions for this field.
   * Maps to iOS `textContentType` and Android `autoComplete`, which iOS's
   * checkout passes for name, email and every address field — without it the
   * user gets no Contacts autofill at all.
   */
  textContentType?: TextInputProps['textContentType'];
  autoComplete?: TextInputProps['autoComplete'];
  /**
   * Restricts what characters the field accepts. iOS's checkout applies
   * `textOnly` to Name, City and State
   * (`FrameCheckoutView.swift:278,351,360`).
   */
  inputRestriction?: TextFieldInputRestriction;
  /** Positive integer; non-positive / non-integer values are ignored. */
  characterLimit?: number;
  /**
   * Suppresses error rendering entirely (the value still flows through, the
   * field just won't show it). Useful when an outer container groups error
   * surfaces for multiple fields. Takes precedence over `inlineError`.
   */
  compactError?: boolean;
  /** When true, error text lays out to the right of the field instead of below. */
  inlineError?: boolean;
  errorSpacing?: number;
  /**
   * Drop the input's own border. Used when the field sits inside an outer
   * bordered container with sibling Dividers (the iOS CustomerInformation
   * pattern), so the chrome lives on the container instead of every field.
   */
  borderless?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  spellCheck?: boolean;
  testID?: string;
  style?: ViewStyle;
  /** Override the screen-reader label. Defaults to `prompt`. */
  accessibilityLabel?: string;
}

const HEIGHT = 49;
const DEFAULT_ERROR_SPACING = 4;

/**
 * A themed text input that displays an inline or stacked error message and
 * announces errors to screen readers via `accessibilityHint`. Follows the
 * Frame design system colors, fonts, and radii from the nearest
 * {@link FrameProvider}.
 *
 * @param props - {@link ValidatedTextFieldProps}
 *
 * @example
 * ```tsx
 * <ValidatedTextField
 *   prompt="Email"
 *   value={email}
 *   onChangeText={setEmail}
 *   error={emailError}
 *   onErrorChange={setEmailError}
 *   keyboardType="email-address"
 * />
 * ```
 */
export function ValidatedTextField({
  prompt,
  value,
  onChangeText,
  error = null,
  onErrorChange,
  keyboardType = 'default',
  textContentType,
  autoComplete,
  inputRestriction,
  characterLimit,
  compactError = false,
  inlineError = false,
  errorSpacing = DEFAULT_ERROR_SPACING,
  borderless = false,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  testID,
  style,
  accessibilityLabel,
}: ValidatedTextFieldProps) {
  const theme = useFrameTheme();

  const handleChange = (next: string) => {
    // Filter BEFORE truncating, matching iOS
    // (ValidatedTextField.swift:157-163): truncating first would let a
    // disallowed character consume one of the allowed slots.
    const truncated = truncateToLimit(applyInputRestriction(next, inputRestriction), characterLimit);
    if (error && onErrorChange) onErrorChange(null);
    onChangeText(truncated);
  };

  const hasError = !!error && !compactError;
  const effectiveMaxLength =
    characterLimit !== undefined && Number.isInteger(characterLimit) && characterLimit > 0
      ? characterLimit
      : undefined;

  const input = (
    <TextInput
      value={value}
      onChangeText={handleChange}
      placeholder={prompt}
      placeholderTextColor={theme.colors.textSecondary}
      keyboardType={keyboardType}
      textContentType={textContentType}
      autoComplete={autoComplete}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      spellCheck={spellCheck}
      maxLength={effectiveMaxLength}
      accessibilityLabel={accessibilityLabel ?? prompt}
      accessibilityHint={error ?? undefined}
      testID={testID}
      style={[
        styles.input,
        borderless ? styles.inputBorderless : null,
        {
          color: theme.colors.textPrimary,
          fontSize: theme.fonts.body.size,
          backgroundColor: borderless ? 'transparent' : theme.colors.surface,
          borderColor:
            borderless && !hasError
              ? 'transparent'
              : hasError
                ? theme.colors.error
                : theme.colors.surfaceStroke,
          borderRadius: borderless ? 0 : theme.radii.small,
        },
      ]}
    />
  );

  const errorText = hasError ? (
    <Text
      accessibilityLiveRegion="polite"
      style={{
        color: theme.colors.error,
        fontSize: theme.fonts.caption.size,
        lineHeight: theme.fontLineHeights.caption,
        marginTop: inlineError ? 0 : errorSpacing,
        marginLeft: inlineError ? errorSpacing : 0,
      }}
    >
      {error}
    </Text>
  ) : null;

  if (inlineError) {
    return (
      <View style={[styles.inlineRow, style]}>
        <View style={styles.inputColumn}>{input}</View>
        {errorText}
      </View>
    );
  }

  return (
    <View style={style}>
      {input}
      {errorText}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: HEIGHT,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  inputBorderless: {
    borderWidth: 0,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputColumn: {
    flex: 1,
  },
});
