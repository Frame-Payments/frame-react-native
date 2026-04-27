/**
 * <FrameApplePayButton /> — iOS-only React Native view that wraps Frame iOS SDK's
 * native FrameApplePayButton (PassKit + automatic device attestation).
 *
 * On non-iOS platforms this component renders nothing, so consumers can place it
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
import type {
  ApplePayButtonStyle,
  ApplePayButtonType,
  ApplePayOwner,
  FrameApplePayResultEvent,
} from '../types';

export interface FrameApplePayButtonProps extends ViewProps {
  /** Payment amount in cents. */
  amount: number;
  /** ISO 4217 currency code. Defaults to 'usd'. */
  currency?: string;
  /** Customer or account that owns the resulting payment method. */
  owner: ApplePayOwner;
  /** Apple Pay merchant ID configured in your Apple Developer account. */
  merchantId: string;
  /** When true, the button renders a "Or" divider beneath itself for inline checkout layouts. */
  addCheckoutDivider?: boolean;
  /** PassKit button type. Defaults to 'buy'. */
  buttonType?: ApplePayButtonType;
  /** PassKit button style. Defaults to 'black'. */
  buttonStyle?: ApplePayButtonStyle;
  /** Fired when payment completes, fails, or the button reports an error. */
  onResult: (event: NativeSyntheticEvent<FrameApplePayResultEvent>) => void;
}

interface NativeProps extends Omit<FrameApplePayButtonProps, 'owner'> {
  owner: { type: 'customer' | 'account'; id: string };
}

const NativeFrameApplePayButton =
  Platform.OS === 'ios'
    ? requireNativeComponent<NativeProps>('FrameApplePayButtonView')
    : null;

let warnedAboutOwner = false;
function warnIfBadOwner(owner: ApplePayOwner | undefined): boolean {
  if (
    !owner ||
    (owner.type !== 'customer' && owner.type !== 'account') ||
    typeof owner.id !== 'string' ||
    owner.id.length === 0
  ) {
    if (!warnedAboutOwner) {
      warnedAboutOwner = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[FrameApplePayButton] `owner` must be { type: "customer" | "account", id: string }. The button will not render until a valid owner is provided.'
      );
    }
    return false;
  }
  return true;
}

export const FrameApplePayButton: React.FC<FrameApplePayButtonProps> = (props) => {
  if (Platform.OS !== 'ios' || NativeFrameApplePayButton === null) {
    return null;
  }
  if (!warnIfBadOwner(props.owner)) {
    return null;
  }
  const { style, ...rest } = props;
  return (
    <NativeFrameApplePayButton
      {...rest}
      style={[styles.button, style]}
    />
  );
};

const styles = StyleSheet.create({
  button: {
    height: 50,
  },
});
