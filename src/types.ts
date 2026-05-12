/**
 * Types for the Frame React Native SDK modal APIs.
 * For other types (Customer, Refund, etc.), use the framepayments (frame-node) package when calling APIs from JS.
 */

/** Cart item for presentCart({ items }) */
export interface FrameCartItem {
  id: string;
  title: string;
  amountInCents: number;
  imageUrl: string;
}

export interface BillingAddress {
  city?: string;
  country?: string;
  state?: string;
  postalCode: string;
  addressLine1?: string;
  addressLine2?: string;
}

export interface PaymentCard {
  brand: string;
  expirationMonth: string;
  expirationYear: string;
  lastFourDigits: string;
  issuer?: string;
  currency?: string;
  type?: string;
}

export interface BankAccount {
  bankName?: string;
  lastFour?: string;
  accountType?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'ach';
  status: string;
  created: number;
  updated: number;
  livemode: boolean;
  object: string;
  customerId?: string;
  card?: PaymentCard;
  ach?: BankAccount;
  billing?: BillingAddress;
}

/** Error shape when native module rejects (same as FrameErrorShape from errors.ts) */
export interface FrameError {
  code: string;
  message: string;
  nativeError?: string;
}

/** Capabilities that drive which onboarding steps are shown */
export type OnboardingCapability =
  | 'kyc'
  | 'kyc_prefill'
  | 'phone_verification'
  | 'creator_shield'
  | 'card_verification'
  | 'card_send'
  | 'card_receive'
  | 'address_verification'
  | 'bank_account_verification'
  | 'bank_account_send'
  | 'bank_account_receive'
  | 'geo_compliance'
  | 'age_verification';

export type OnboardingResultStatus = 'completed' | 'cancelled';

/** Result returned from presentOnboarding */
export interface OnboardingResult {
  status: OnboardingResultStatus;
  /** Present when status === 'completed' and a payment method was created/verified */
  paymentMethodId?: string;
}

/**
 * Identifies who the wallet payment method belongs to and which downstream
 * resource is created when the user authorizes payment. Used by both
 * `presentApplePay` and `presentGooglePay`.
 *
 *  - `{ type: 'customer', id }` → creates a `ChargeIntent`; promise resolves with the ChargeIntent id.
 *  - `{ type: 'account',  id }` → creates a `Transfer`;     promise resolves with the Transfer id.
 *
 * The promise always resolves with a string id; the caller knows which resource
 * it refers to based on the owner type they passed in.
 */
export type WalletOwner =
  | { type: 'customer'; id: string }
  | { type: 'account'; id: string };

/** @deprecated Use {@link WalletOwner}. Retained as an alias for source compatibility. */
export type ApplePayOwner = WalletOwner;

/** Options for Frame.presentApplePay. */
export interface PresentApplePayOptions {
  /** Payment amount in cents. */
  amount: number;
  /** ISO 4217 currency code. Defaults to 'usd'. */
  currency?: string;
  /** Customer or account that owns the resulting payment method and charge. */
  owner: WalletOwner;
  /** Apple Pay merchant ID configured in your Apple Developer account. */
  merchantId: string;
}

/** Options for Frame.presentGooglePay. */
export interface PresentGooglePayOptions {
  /** Payment amount in cents. */
  amountCents: number;
  /** Customer or account that owns the resulting payment method and charge. */
  owner: WalletOwner;
  /** ISO 4217 currency code. Defaults to 'USD'. */
  currencyCode?: string;
  /** Optional override for the Google Pay merchant ID. */
  googlePayMerchantId?: string;
}

/**
 * Theming for Frame's reusable iOS components (checkout, cart, onboarding).
 * iOS-only: on Android, Frame.setTheme() resolves immediately and has no effect
 * until frame-android ships a matching theme API.
 *
 * Pass any subset — unspecified tokens fall back to SDK defaults.
 */

/** Hex color: '#RGB', '#RRGGBB', or '#RRGGBBAA' (with or without leading '#'). */
export type FrameThemeColor = string;

/**
 * Custom font reference. `name` must be a PostScript font name registered in
 * the host app's Info.plist `UIAppFonts` and bundled as a resource. Pass
 * `name: 'system'` to use the system font at the given size.
 */
export interface FrameThemeFont {
  name: string;
  size: number;
}

export interface FrameThemeColors {
  primaryButton?: FrameThemeColor;
  primaryButtonText?: FrameThemeColor;
  secondaryButton?: FrameThemeColor;
  secondaryButtonText?: FrameThemeColor;
  disabledButton?: FrameThemeColor;
  disabledButtonStroke?: FrameThemeColor;
  disabledButtonText?: FrameThemeColor;
  surface?: FrameThemeColor;
  surfaceStroke?: FrameThemeColor;
  textPrimary?: FrameThemeColor;
  textSecondary?: FrameThemeColor;
  error?: FrameThemeColor;
  onboardingHeaderBackground?: FrameThemeColor;
  onboardingProgressFilledOnBrand?: FrameThemeColor;
  onboardingProgressEmptyOnBrand?: FrameThemeColor;
}

export interface FrameThemeFonts {
  title?: FrameThemeFont;
  heading?: FrameThemeFont;
  headline?: FrameThemeFont;
  body?: FrameThemeFont;
  bodySmall?: FrameThemeFont;
  label?: FrameThemeFont;
  caption?: FrameThemeFont;
  button?: FrameThemeFont;
}

export interface FrameThemeRadii {
  small?: number;
  medium?: number;
  large?: number;
}

export interface FrameTheme {
  colors?: FrameThemeColors;
  fonts?: FrameThemeFonts;
  radii?: FrameThemeRadii;
}
