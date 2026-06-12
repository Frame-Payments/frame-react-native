/**
 * A single line item in a cart presented via {@link presentCart}.
 */
export interface FrameCartItem {
  /** Unique identifier for this item. */
  id: string;
  /** Display name shown in the cart UI. */
  title: string;
  /** Item price in the smallest currency unit (e.g. cents for USD). */
  amountInCents: number;
  /** URL of the product image shown alongside the title. */
  imageUrl: string;
}

/**
 * A postal billing address associated with a payment method or checkout.
 */
export interface BillingAddress {
  /** City or locality. */
  city?: string;
  /** ISO 3166-1 alpha-2 country code (e.g. `'US'`). */
  country?: string;
  /** State, province, or region. */
  state?: string;
  /** Postal or ZIP code. */
  postalCode: string;
  /** Street address line 1. */
  addressLine1?: string;
  /** Street address line 2 (apartment, suite, etc.). */
  addressLine2?: string;
}

/**
 * Card details returned on a saved {@link PaymentMethod}.
 */
export interface PaymentCard {
  /** Card network brand (e.g. `'visa'`, `'mastercard'`, `'amex'`). */
  brand: string;
  /** Two-digit expiration month (e.g. `'01'`). */
  expirationMonth: string;
  /** Four-digit expiration year (e.g. `'2027'`). */
  expirationYear: string;
  /** Last four digits of the card number. */
  lastFourDigits: string;
  /** Issuing bank name, if available. */
  issuer?: string;
  /** ISO 4217 currency code the card is denominated in, if available. */
  currency?: string;
  /** Card product type (e.g. `'credit'`, `'debit'`). */
  type?: string;
}

/**
 * Bank account details returned on a saved {@link PaymentMethod}.
 */
export interface BankAccount {
  /** Name of the financial institution. */
  bankName?: string;
  /** Last four digits of the account number. */
  lastFour?: string;
  /** Account type (e.g. `'checking'`, `'savings'`). */
  accountType?: string;
}

/**
 * A stored payment method belonging to a Frame customer. The `type` field
 * determines which of `card` or `ach` is populated.
 *
 * @example
 * ```ts
 * if (method.type === 'card') {
 *   console.log(method.card?.brand, method.card?.lastFourDigits);
 * }
 * ```
 */
export interface PaymentMethod {
  /** Frame-assigned payment method identifier. */
  id: string;
  /** Payment instrument type. */
  type: 'card' | 'ach';
  /** Lifecycle status (e.g. `'active'`, `'expired'`). */
  status: string;
  /** Unix timestamp (seconds) when the payment method was created. */
  created: number;
  /** Unix timestamp (seconds) of the last update. */
  updated: number;
  /** `true` when the payment method was created in live mode. */
  livemode: boolean;
  /** API object name, always `'payment_method'`. */
  object: string;
  /** Frame customer ID this payment method belongs to, if applicable. */
  customerId?: string;
  /** Populated when `type === 'card'`. */
  card?: PaymentCard;
  /** Populated when `type === 'ach'`. */
  ach?: BankAccount;
  /** Billing address associated with this payment method. */
  billing?: BillingAddress;
}

/**
 * Onboarding capability identifier. Pass one or more to
 * {@link PresentOnboardingOptions.capabilities} to request specific
 * verification steps.
 */
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

/**
 * Terminal outcome of the onboarding flow returned by {@link presentOnboarding}.
 */
export type OnboardingResultStatus = 'completed' | 'cancelled';

/**
 * Result returned when the {@link presentOnboarding} promise resolves.
 */
export interface OnboardingResult {
  /** Whether the user completed or cancelled the flow. */
  status: OnboardingResultStatus;
  /**
   * The account the user onboarded against. Populated on `status: 'completed'`
   * for both the host-supplied accountId path and the empty-account
   * auto-create path. Use this to fetch payment methods, capabilities, or
   * profile data server-side after onboarding.
   */
  accountId?: string;
}

/**
 * Identifies the Frame entity that owns the wallet payment. Resolves to a
 * ChargeIntent ID when `type === 'customer'` and a Transfer ID when
 * `type === 'account'`.
 */
export type WalletOwner =
  | { type: 'customer'; id: string }
  | { type: 'account'; id: string };

/** @deprecated Use {@link WalletOwner}. */
export type ApplePayOwner = WalletOwner;

/**
 * Options for {@link presentApplePay}.
 */
export interface PresentApplePayOptions {
  /** Payment amount in the smallest currency unit (e.g. cents for USD). */
  amount: number;
  /** ISO 4217 currency code. Defaults to `'USD'` when omitted. */
  currency?: string;
  /** Frame entity that receives the payment. Determines the resolved ID type. */
  owner: WalletOwner;
}

/**
 * Options for {@link presentGooglePay}.
 */
export interface PresentGooglePayOptions {
  /** Payment amount in cents. */
  amountCents: number;
  /** Frame entity that receives the payment. Determines the resolved ID type. */
  owner: WalletOwner;
  /** ISO 4217 currency code. Defaults to `'USD'` when omitted. */
  currencyCode?: string;
}

/**
 * A CSS hex color string (e.g. `'#324D52'` or `'#324D5259'` with alpha).
 */
export type FrameThemeColor = string;

/**
 * A custom font specification used within {@link FrameThemeFonts}.
 */
export interface FrameThemeFont {
  /** Font family name, or `'system'` to use the platform system font. */
  name: string;
  /** Font size in points. */
  size: number;
}

/**
 * Color overrides for the Frame SDK UI. All fields are optional; omitted
 * colors fall back to the scheme defaults resolved by {@link resolveTheme}.
 */
export interface FrameThemeColors {
  /** Background color of primary action buttons. */
  primaryButton?: FrameThemeColor;
  /** Text/icon color on primary buttons. */
  primaryButtonText?: FrameThemeColor;
  /** Background color of secondary action buttons. */
  secondaryButton?: FrameThemeColor;
  /** Text/icon color on secondary buttons. */
  secondaryButtonText?: FrameThemeColor;
  /** Background color of disabled buttons. */
  disabledButton?: FrameThemeColor;
  /** Border color of disabled buttons. */
  disabledButtonStroke?: FrameThemeColor;
  /** Text/icon color on disabled buttons. */
  disabledButtonText?: FrameThemeColor;
  /** Background color of card/sheet surfaces. */
  surface?: FrameThemeColor;
  /** Border color of card/sheet surfaces. */
  surfaceStroke?: FrameThemeColor;
  /** Primary text color. */
  textPrimary?: FrameThemeColor;
  /** Secondary/placeholder text color. */
  textSecondary?: FrameThemeColor;
  /** Validation error indicator color. */
  error?: FrameThemeColor;
  /** Background color of in-app toast notifications. */
  toastBackground?: FrameThemeColor;
  /** Text color of in-app toast notifications. */
  toastText?: FrameThemeColor;
  /** Background color of the onboarding header bar. */
  onboardingHeaderBackground?: FrameThemeColor;
  /** Color of the filled segment of the onboarding progress indicator. */
  onboardingProgressFilledOnBrand?: FrameThemeColor;
  /** Color of the empty segment of the onboarding progress indicator. */
  onboardingProgressEmptyOnBrand?: FrameThemeColor;
}

/**
 * Font overrides for each text role in the Frame SDK UI. All fields are
 * optional; omitted roles use the platform system font at the default size.
 */
export interface FrameThemeFonts {
  /** Large page title (default 24 pt, weight 700). */
  title?: FrameThemeFont;
  /** Section heading (default 24 pt, weight 600). */
  heading?: FrameThemeFont;
  /** Sub-section headline (default 18 pt, weight 600). */
  headline?: FrameThemeFont;
  /** Body copy (default 14 pt, weight 400). */
  body?: FrameThemeFont;
  /** Small body copy (default 12 pt, weight 400). */
  bodySmall?: FrameThemeFont;
  /** Form field label (default 14 pt, weight 600). */
  label?: FrameThemeFont;
  /** Caption / helper text (default 11 pt, weight 400). */
  caption?: FrameThemeFont;
  /** Button label (default 14 pt, weight 600). */
  button?: FrameThemeFont;
}

/**
 * Corner-radius overrides for the Frame SDK UI surfaces. Values are in points.
 */
export interface FrameThemeRadii {
  /** Small radius applied to text inputs (default 8). */
  small?: number;
  /** Medium radius applied to buttons and cards (default 10). */
  medium?: number;
  /** Large radius applied to bottom sheets (default 16). */
  large?: number;
}

/**
 * Top-level theme object passed to {@link initialize} and {@link FrameProvider}.
 * All fields are optional; omitted sections fall back to the built-in scheme
 * defaults. Mirrors iOS `.frameTheme(_:)` and Android `FrameTheme(theme = …)`.
 *
 * @example
 * ```ts
 * const theme: FrameTheme = {
 *   colors: { primaryButton: '#1A2B3C' },
 *   radii: { medium: 12 },
 * };
 * await Frame.initialize({ secretKey, publishableKey, theme });
 * ```
 */
export interface FrameTheme {
  /** Color overrides merged on top of the current color-scheme defaults. */
  colors?: FrameThemeColors;
  /** Font overrides for each text role. */
  fonts?: FrameThemeFonts;
  /** Corner-radius overrides for UI surfaces. */
  radii?: FrameThemeRadii;
}
