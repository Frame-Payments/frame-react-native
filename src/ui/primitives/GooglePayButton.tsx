import { Platform, StyleSheet, View, requireNativeComponent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';

// Google Pay brand guidelines mandate the official PayButton (play-services-wallet:19.4.0+).
// Hosted via FrameGooglePayButtonViewManager. Returns an empty View on iOS so
// the JS caller can render it unconditionally.

/**
 * Color theme of the Google Pay button. Maps to `ButtonTheme` from the
 * `play-services-wallet` Android library.
 */
export type GooglePayButtonTheme = 'dark' | 'light';

/**
 * Call-to-action label displayed inside the Google Pay button. Maps to
 * `ButtonType` from the `play-services-wallet` Android library.
 */
export type GooglePayButtonType = 'pay' | 'buy' | 'book' | 'checkout' | 'donate' | 'order' | 'subscribe' | 'plain';

interface NativeGooglePayButtonProps {
  buttonTheme: GooglePayButtonTheme;
  buttonType: GooglePayButtonType;
  cornerRadiusDp: number;
  onPress?: (event: NativeSyntheticEvent<unknown>) => void;
  style?: StyleProp<ViewStyle>;
}

const NativeGooglePayButton =
  Platform.OS === 'android'
    ? requireNativeComponent<NativeGooglePayButtonProps>('FrameGooglePayButton')
    : null;

/**
 * Props for the {@link GooglePayButton} component.
 */
export interface GooglePayButtonProps {
  /** Color theme of the button. Defaults to `'dark'`. */
  buttonTheme?: GooglePayButtonTheme;
  /** Call-to-action label. Defaults to `'pay'`. */
  buttonType?: GooglePayButtonType;
  /** Corner radius in dp, defaults to 8. */
  cornerRadiusDp?: number;
  /** Called when the user taps the button. */
  onPress: () => void;
  /** Additional style merged onto the native button container. */
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_HEIGHT = 50;

/**
 * Renders the official Google Pay `PayButton` via the `FrameGooglePayButton`
 * native view on Android (requires `play-services-wallet:19.4.0+`). On iOS,
 * renders an invisible placeholder `View` so the caller can render this
 * component unconditionally without platform guards.
 *
 * Google Pay brand guidelines mandate using the official button — custom
 * styled alternatives are not permitted.
 *
 * @param props - {@link GooglePayButtonProps}
 *
 * @example
 * ```tsx
 * {showGooglePay && (
 *   <GooglePayButton onPress={handleGooglePay} buttonType="pay" />
 * )}
 * ```
 */
export function GooglePayButton({
  buttonTheme = 'dark',
  buttonType = 'pay',
  cornerRadiusDp = 8,
  onPress,
  style,
}: GooglePayButtonProps) {
  if (Platform.OS !== 'android' || NativeGooglePayButton === null) {
    return <View style={[styles.fallback, style]} />;
  }
  return (
    <NativeGooglePayButton
      buttonTheme={buttonTheme}
      buttonType={buttonType}
      cornerRadiusDp={cornerRadiusDp}
      onPress={onPress}
      style={[styles.button, style]}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    height: DEFAULT_HEIGHT,
    width: '100%',
  },
  fallback: {
    height: DEFAULT_HEIGHT,
  },
});
