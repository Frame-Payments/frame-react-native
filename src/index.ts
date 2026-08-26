/**
 * framepayments-react-native
 *
 * React Native SDK for Frame Payments.
 * - Initialize the SDK, then use presentCheckout / presentCart for payment UI.
 * - Use presentOnboarding for KYC, identity verification, and payment method onboarding flows.
 * - Use presentAddPaymentMethod / presentAddPayoutMethod (iOS-only) to add a payment or payout
 *   method outside onboarding, at an arbitrary point in your app.
 * - Use presentSelectPayoutMethod (iOS-only) to let a user choose which bank account is the
 *   account's primary payout destination.
 * - Use presentApplePay / presentGooglePay to launch the platform wallet sheet from your own button UI.
 * - For API calls (customers, charge intents, refunds), use the framepayments (frame-node) package from JS.
 */

import {
  initialize,
  presentCheckout,
  presentCart,
  presentOnboarding,
  presentAddPaymentMethod,
  presentAddPayoutMethod,
  presentSelectPayoutMethod,
  presentApplePay,
  presentGooglePay,
  resetDeviceAttestation,
} from './native';

export {
  initialize,
  presentCheckout,
  presentCart,
  presentOnboarding,
  presentAddPaymentMethod,
  presentAddPayoutMethod,
  presentSelectPayoutMethod,
  presentApplePay,
  presentGooglePay,
  resetDeviceAttestation,
} from './native';
export type {
  FrameCartItem,
  FrameError,
  BillingAddress,
  PaymentCard,
  BankAccount,
  PaymentMethod,
  OnboardingCapability,
  OnboardingResult,
  OnboardingResultStatus,
  AddMethodResult,
  WalletOwner,
  ApplePayOwner,
  PresentApplePayOptions,
  PresentGooglePayOptions,
  FrameTheme,
  FrameThemeColor,
  FrameThemeFont,
  FrameThemeColors,
  FrameThemeFonts,
  FrameThemeRadii,
} from './types';
export { ErrorCodes } from './errors';
export type { FrameErrorShape, FrameErrorCode } from './errors';

/** Default export for Frame.initialize(), Frame.presentCheckout(), Frame.presentCart(), Frame.presentOnboarding(), Frame.presentAddPaymentMethod(), Frame.presentAddPayoutMethod(), Frame.presentSelectPayoutMethod(), Frame.presentApplePay(), Frame.presentGooglePay() */
export default {
  initialize,
  presentCheckout,
  presentCart,
  presentOnboarding,
  presentAddPaymentMethod,
  presentAddPayoutMethod,
  presentSelectPayoutMethod,
  presentApplePay,
  presentGooglePay,
  resetDeviceAttestation,
};
