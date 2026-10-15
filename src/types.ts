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

/**
 * Short-lived `chk_sess_…` token from `POST /v1/checkout_sessions`. Required by
 * `presentCheckout` / `presentCart`. Checkout loads the account name, email, and saved
 * cards with it.
 */
export interface CheckoutClientSecret {
  /** The `chk_sess_…` bearer token. */
  clientSecret: string;
  /** Unix timestamp in seconds when the token stops being accepted. */
  expiresAt: number;
  /**
   * Locked charge amount in the smallest currency unit. When the session can create a
   * V2 transfer, refresh replays this amount. Optional — checkout stamps it from the
   * payment amount when omitted.
   */
  amountCents?: number;
  /** ISO 4217 currency code for `amountCents` (e.g. `"usd"`). */
  amountCurrency?: string;
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
  | 'age_verification'
  /** Requires government-issued photo ID verification via Persona. */
  | 'idv';

export type OnboardingResultStatus = 'completed' | 'cancelled' | 'unverified';

export type OnboardingOutcome = 'approved' | 'pendingReview' | 'declined' | 'actionRequired';

/** Result returned from presentOnboarding */
export interface OnboardingResult {
  status: OnboardingResultStatus;
  /** The onboarded account's id. Present when status is 'completed' or 'unverified'. */
  accountId?: string;
  /** Android only: the payment method added during the flow. */
  paymentMethodId?: string;
  outcome?: OnboardingOutcome;
  message?: string;
}

/** Result returned from presentAddPaymentMethod / presentAddPayoutMethod */
export interface AddMethodResult {
  status: OnboardingResultStatus;
  /** Present when status === 'completed': the id of the newly added payment or payout method */
  methodId?: string;
}

/**
 * Identifies who the wallet payment method belongs to. Used by both
 * `presentApplePay` and `presentGooglePay`.
 *
 * Charges require `{ type: 'account', id }` and create a V2 Transfer.
 * `{ type: 'customer', id }` is rejected — ChargeIntents were removed with
 * Transfers V2 (frame-ios 4.7 / frame-android 3.3).
 */
export type WalletOwner =
  | { type: 'customer'; id: string }
  | { type: 'account'; id: string };

/** @deprecated Use {@link WalletOwner}. Retained as an alias for source compatibility. */
export type ApplePayOwner = WalletOwner;

/**
 * Options for Frame.presentApplePay.
 *
 * The Apple Pay merchant ID is set once at `Frame.initialize({ applePayMerchantId })`. There is
 * no per-call merchant ID parameter — the SDK reads it from the singleton at present time.
 */
export interface PresentApplePayOptions {
  /** Payment amount in cents. */
  amount: number;
  /** ISO 4217 currency code. Defaults to 'usd'. */
  currency?: string;
  /** Account that owns the resulting payment method and V2 Transfer. Customer owners are rejected. */
  owner: WalletOwner;
}

/**
 * Options for Frame.presentGooglePay.
 *
 * The Google Pay merchant ID is set once at `Frame.initialize({ googlePayMerchantId })`. There
 * is no per-call merchant ID parameter — the SDK reads it from the singleton at present time.
 */
export interface PresentGooglePayOptions {
  /** Payment amount in cents. */
  amountCents: number;
  /** Account that owns the resulting payment method and V2 Transfer. Customer owners are rejected. */
  owner: WalletOwner;
  /** ISO 4217 currency code. Defaults to 'USD'. */
  currencyCode?: string;
}

/**
 * Theming for Frame's reusable components (checkout, cart, onboarding).
 * Applied on both iOS and Android.
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
