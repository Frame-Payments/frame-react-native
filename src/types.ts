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

export interface OnboardingResult {
  status: OnboardingResultStatus;
  /**
   * The account the user onboarded against. Populated on `status: 'completed'`
   * for both the host-supplied accountId path and the empty-account
   * auto-create path. Use this to fetch payment methods, capabilities, or
   * profile data server-side after onboarding.
   */
  accountId?: string;
}

// presentApplePay/presentGooglePay resolve with a ChargeIntent id when
// owner.type === 'customer' and a Transfer id when owner.type === 'account'.
// The caller's owner type determines which id they should expect.
export type WalletOwner =
  | { type: 'customer'; id: string }
  | { type: 'account'; id: string };

/** @deprecated Use {@link WalletOwner}. */
export type ApplePayOwner = WalletOwner;

export interface PresentApplePayOptions {
  amount: number;
  currency?: string;
  owner: WalletOwner;
}

export interface PresentGooglePayOptions {
  amountCents: number;
  owner: WalletOwner;
  currencyCode?: string;
}

export type FrameThemeColor = string;

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
  toastBackground?: FrameThemeColor;
  toastText?: FrameThemeColor;
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
