import { Platform, StyleSheet, View, requireNativeComponent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';

// Apple HIG mandates the system-drawn PKPaymentButton; we host one inside a
// native UIView via FrameApplePayButtonView. Returns an empty View on Android
// so the JS caller can render it unconditionally.

export type ApplePayButtonStyle = 'black' | 'white' | 'whiteOutline' | 'automatic';
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

export interface ApplePayButtonProps {
  buttonStyle?: ApplePayButtonStyle;
  buttonType?: ApplePayButtonType;
  /** Corner radius in points; defaults to 10 (matches theme.radii.medium). */
  cornerRadius?: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_HEIGHT = 50;

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
