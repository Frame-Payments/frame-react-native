import { Platform, StyleSheet, View, requireNativeComponent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';

// Google Pay brand guidelines mandate the official PayButton (play-services-wallet:19.4.0+).
// Hosted via FrameGooglePayButtonViewManager. Returns an empty View on iOS so
// the JS caller can render it unconditionally.

export type GooglePayButtonTheme = 'dark' | 'light';
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

export interface GooglePayButtonProps {
  buttonTheme?: GooglePayButtonTheme;
  buttonType?: GooglePayButtonType;
  /** Corner radius in dp, defaults to 8. */
  cornerRadiusDp?: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_HEIGHT = 50;

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
