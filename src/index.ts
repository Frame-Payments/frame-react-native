import {
  initialize,
  presentCheckout,
  presentCart,
  presentOnboarding,
  presentApplePay,
  presentGooglePay,
  presentAddPaymentMethod,
  presentAddPayoutMethod,
  presentSelectPayoutMethod,
} from './native';

export {
  initialize,
  presentCheckout,
  presentCart,
  presentOnboarding,
  presentApplePay,
  presentGooglePay,
  presentAddPaymentMethod,
  presentAddPayoutMethod,
  presentSelectPayoutMethod,
} from './native';
export type {
  PresentCheckoutOptions,
  PresentCartOptions,
  PresentOnboardingOptions,
  PresentMethodOptions,
} from './native';
export type { AddressMode } from './ui/screens/checkout/checkoutReducer';
export type {
  FrameCartItem,
  BillingAddress,
  PaymentCard,
  BankAccount,
  PaymentMethod,
  OnboardingCapability,
  OnboardingResult,
  OnboardingResultStatus,
  OnboardingOutcome,
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
export { isOnboardingApproved } from './types';
// Frame's legal document URLs, sourced from the configuration API with bundled
// fallbacks. iOS exposes the same four as LegalConfiguration.
export { getLegalUrls, type LegalUrls } from './legal';
export {
  TermsOfServiceView,
  type TermsOfServiceViewProps,
} from './ui/primitives/TermsOfServiceView';
export { ErrorCodes } from './errors';
export {
  isThreeDSecureAvailable,
} from './ui/primitives/ThreeDSecureChallenge';
export type {
  ChargeOutcome,
  ThreeDSecureChallengeResult,
} from './threeDSecure';
export type { FrameErrorShape, FrameErrorCode } from './errors';
// Host apps need this to render a caught Frame error: the top-level `message`
// on an API rejection is a generic envelope, and the actionable reason lives in
// `error_details.message` underneath it.
export { toToastMessage, isNotFoundError, DEFAULT_TOAST_FALLBACK } from './api-errors';

export { FrameProvider, type FrameProviderProps } from './ui/FrameProvider';
export { useFrameTheme } from './ui/theme/ThemeContext';
export { resolveTheme, type ColorScheme, type ResolvedFrameTheme } from './ui/theme/defaults';
export { Button, type ButtonProps, type ButtonVariant } from './ui/primitives/Button';
export { ValidatedTextField, type ValidatedTextFieldProps } from './ui/primitives/ValidatedTextField';
export {
  ApplePayButton,
  type ApplePayButtonProps,
  type ApplePayButtonStyle,
  type ApplePayButtonType,
} from './ui/primitives/ApplePayButton';
export {
  GooglePayButton,
  type GooglePayButtonProps,
  type GooglePayButtonTheme,
  type GooglePayButtonType,
} from './ui/primitives/GooglePayButton';

// Primitives iOS marks `public` on FrameOnboarding / Frame, so host apps can
// compose Frame-styled forms outside the SDK's own screens.
export { PaymentMethodRow, type PaymentMethodRowProps } from './ui/primitives/PaymentMethodRow';
export { CountryPicker, type CountryPickerProps } from './ui/primitives/CountryPicker';
export {
  PhoneCountryPicker,
  type PhoneCountryPickerProps,
} from './ui/primitives/PhoneCountryPicker';
export { PhoneNumberField, type PhoneNumberFieldProps } from './ui/primitives/PhoneNumberField';
export { Checkbox, type CheckboxProps } from './ui/primitives/Checkbox';
export {
  PaymentCardField,
  type PaymentCardFieldProps,
  type PaymentCardFieldHandle,
} from './ui/primitives/PaymentCardField';

// iOS exposes FrameToastCenter publicly so the Onboarding module — and host
// apps — can emit into the same overlay the SDK's screens use.
export {
  showToast,
  dismissActive as dismissToast,
  type ShowToastOptions,
  type ToastEntry,
} from './ui/primitives/toastCenter';

export {
  validateNonEmpty,
  validateFullName,
  validateEmail,
  validateZipUS,
  validateCard,
  validateCardExpiry,
  validateSSNLast4,
  validateRoutingNumberUS,
  validateAccountNumberUS,
  validateDateOfBirth,
  validatePostalCode,
  validatePhoneE164,
  validateSubregion,
  detectCardBrand,
  getSupportedPostalCodeCountries,
  POSTAL_CODE_COUNTRIES,
  type PostalCountryCode,
} from './validation';
import * as Validators from './validation';
import { convertCentsToCurrencyString } from './currency';
export { Validators };

// Per-country address presentation and the subregion tables Frame validates
// against. iOS exposes AddressFormat and AddressSubregions publicly.
export { addressFormatForCountry, type AddressFormat } from './addressFormat';
export {
  subregionsForCountry,
  subregionCodesForCountry,
  findSubregion,
  normalizeSubregion,
  UNITED_STATES_SUBREGIONS,
  CANADA_SUBREGIONS,
  type AddressSubregion,
} from './addressSubregions';

export {
  DEFAULT_COUNTRY,
  RESTRICTED_ALPHA2_CODES,
  RESTRICTED_COUNTRY_NAMES,
  alpha2ToFlag,
  getAllCountries,
  getAvailableCountries,
  getPhoneCountries,
  type AvailableCountry,
  type PhoneCountry,
} from './countries';

export { convertCentsToCurrencyString } from './currency';

export {
  configureEvervault,
  encryptWithEvervault,
  isEvervaultConfigured,
} from './evervault';

export {
  ensureAttested,
  generateAssertionForPayment,
  getAttestedKeyId,
  isAttestationSupported,
  resetAttestation,
} from './attestation';

export default {
  initialize,
  presentCheckout,
  presentCart,
  presentOnboarding,
  presentApplePay,
  presentGooglePay,
  presentAddPaymentMethod,
  presentAddPayoutMethod,
  presentSelectPayoutMethod,
  Validators,
  convertCentsToCurrencyString,
};
