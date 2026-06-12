import { Platform, StyleSheet, View, requireNativeComponent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';

// Apple HIG mandates the system-drawn PKPaymentButton; we host one inside a
// native UIView via FrameApplePayButtonView. Returns an empty View on Android
// so the JS caller can render it unconditionally.

/**
 * Visual color style of the Apple Pay button. Maps to `PKPaymentButtonStyle`
 * values defined by Apple's PassKit framework.
 */
export type ApplePayButtonStyle = 'black' | 'white' | 'whiteOutline' | 'automatic';

/**
 * Call-to-action label displayed inside the Apple Pay button. Maps to
 * `PKPaymentButtonType` values defined by Apple's PassKit framework.
 */
export type ApplePayButtonType =
  | 'plain'
  | 'buy'
  | 'setUp'
  | 'inStore'
  | 'donate'
  | 'checkout'
  | 'book'
  | 'subscribe'
  | 'reload'
  | 'addMoney'
  | 'topUp'
  | 'order'
  | 'rent'
  | 'support'
  | 'contribute'
  | 'tip'
  | 'continue';

interface NativeApplePayButtonProps {
  buttonStyle: ApplePayButtonStyle;
  buttonType: ApplePayButtonType;
  cornerRadius: number;
  onPress?: (event: NativeSyntheticEvent<unknown>) => void;
  style?: StyleProp<ViewStyle>;
}

const NativeApplePayButton =
  Platform.OS === 'ios'
    ? requireNativeComponent<NativeApplePayButtonProps>('FrameApplePayButton')
    : null;

/**
 * Props for the {@link ApplePayButton} component.
 */
export interface ApplePayButtonProps {
  /** Color style of the button. Defaults to `'black'`. */
  buttonStyle?: ApplePayButtonStyle;
  /** Call-to-action label. Defaults to `'buy'`. */
  buttonType?: ApplePayButtonType;
  /** Corner radius in points; defaults to 10 (matches theme.radii.medium). */
  cornerRadius?: number;
  /** Called when the user taps the button. */
  onPress: () => void;
  /** Additional style merged onto the native button container. */
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_HEIGHT = 50;

/**
 * Renders the system-drawn `PKPaymentButton` via the `FrameApplePayButton`
 * native view on iOS. On Android, renders an invisible placeholder `View` so
 * the caller can render this component unconditionally without platform guards.
 *
 * Apple HIG requires using the system-drawn button — custom styled alternatives
 * are not permitted in the App Store.
 *
 * @param props - {@link ApplePayButtonProps}
 *
 * @example
 * ```tsx
 * {showApplePay && (
 *   <ApplePayButton onPress={handleApplePay} buttonType="buy" />
 * )}
 * ```
 */
export function ApplePayButton({
  buttonStyle = 'black',
  buttonType = 'buy',
  cornerRadius = 10,
  onPress,
  style,
}: ApplePayButtonProps) {
  if (Platform.OS !== 'ios' || NativeApplePayButton === null) {
    return <View style={[styles.fallback, style]} />;
  }
  return (
    <NativeApplePayButton
      buttonStyle={buttonStyle}
      buttonType={buttonType}
      cornerRadius={cornerRadius}
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
