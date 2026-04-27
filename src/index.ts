/**
 * framepayments-react-native
 *
 * React Native SDK for Frame Payments.
 * - Initialize the SDK, then use presentCheckout / presentCart for payment UI.
 * - Use presentOnboarding for KYC, identity verification, and payment method onboarding flows.
 * - Drop in <FrameApplePayButton /> or <FrameGooglePayButton /> for one-tap wallet payments.
 * - For API calls (customers, charge intents, refunds), use the framepayments (frame-node) package from JS.
 */

import { initialize, presentCheckout, presentCart, presentOnboarding } from './native';

export { initialize, presentCheckout, presentCart, presentOnboarding } from './native';
export { FrameApplePayButton, FrameGooglePayButton } from './components';
export type {
  FrameApplePayButtonProps,
  FrameGooglePayButtonProps,
} from './components';
export type {
  FrameCartItem,
  ChargeIntent,
  ChargeIntentStatus,
  AuthorizationMode,
  FrameError,
  BillingAddress,
  PaymentCard,
  BankAccount,
  PaymentMethod,
  OnboardingCapability,
  OnboardingResult,
  OnboardingResultStatus,
  ApplePayOwner,
  ApplePayButtonType,
  ApplePayButtonStyle,
  FrameApplePayResultEvent,
  FrameGooglePayResultEvent,
} from './types';
export { ErrorCodes } from './errors';
export type { FrameErrorShape, FrameErrorCode } from './errors';

/** Default export for Frame.initialize(), Frame.presentCheckout(), Frame.presentCart(), Frame.presentOnboarding() */
export default { initialize, presentCheckout, presentCart, presentOnboarding };
