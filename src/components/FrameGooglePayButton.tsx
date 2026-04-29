/**
 * <FrameGooglePayButton /> — Android-only React Native view that wraps Frame Android SDK's
 * native FrameGooglePayButton (Google Pay PaymentsClient + readiness check).
 *
 * On non-Android platforms this component renders nothing, so consumers can place it
 * unconditionally in their JSX.
 */

import * as React from 'react';
import {
  Platform,
  StyleSheet,
  requireNativeComponent,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';
import type { FrameGooglePayResultEvent } from '../types';

export interface FrameGooglePayButtonProps extends ViewProps {
  /** Payment amount in cents. */
  amountCents: number;
  /** Optional Frame customer ID to associate the resulting payment method with. */
  customerId?: string;
  /** ISO 4217 currency code. Defaults to 'USD'. */
  currencyCode?: string;
  /** Optional override for the Google Pay merchant ID. */
  googlePayMerchantId?: string;
  /** Fired when payment completes, fails, or the user cancels the Google Pay sheet. */
  onResult: (event: NativeSyntheticEvent<FrameGooglePayResultEvent>) => void;
  /** Fired when Google Pay readiness changes (button shows/hides itself accordingly). */
  onReadinessChanged?: (event: NativeSyntheticEvent<{ isReady: boolean }>) => void;
}

const NativeFrameGooglePayButton =
  Platform.OS === 'android'
    ? requireNativeComponent<FrameGooglePayButtonProps>('FrameGooglePayButtonView')
    : null;

export const FrameGooglePayButton: React.FC<FrameGooglePayButtonProps> = (props) => {
  if (Platform.OS !== 'android' || NativeFrameGooglePayButton === null) {
    return null;
  }
  const { style, ...rest } = props;
  return (
    <NativeFrameGooglePayButton
      {...rest}
      style={[styles.button, style]}
    />
  );
};

const styles = StyleSheet.create({
  button: {
    height: 48,
  },
});
