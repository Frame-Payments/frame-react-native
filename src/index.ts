import {
  initialize,
  presentCheckout,
  presentCart,
  presentOnboarding,
  presentApplePay,
  presentGooglePay,
} from './native';

export {
  initialize,
  presentCheckout,
  presentCart,
  presentOnboarding,
  presentApplePay,
  presentGooglePay,
} from './native';
export type {
  FrameCartItem,
  BillingAddress,
  PaymentCard,
  BankAccount,
  PaymentMethod,
  OnboardingCapability,
  OnboardingResult,
  OnboardingResultStatus,
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
  detectCardBrand,
  getSupportedPostalCodeCountries,
  POSTAL_CODE_COUNTRIES,
  type PostalCountryCode,
} from './validation';
import * as Validators from './validation';
import { convertCentsToCurrencyString } from './currency';
export { Validators };

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
  Validators,
  convertCentsToCurrencyString,
};
