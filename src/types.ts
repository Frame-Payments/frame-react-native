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

export type ChargeIntentStatus =
  | 'canceled'
  | 'disputed'
  | 'failed'
  | 'incomplete'
  | 'pending'
  | 'refunded'
  | 'reversed'
  | 'succeeded';

export type AuthorizationMode = 'automatic' | 'manual';

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

export interface Customer {
  id: string;
  object: string;
  created: number;
  updated: number;
  livemode: boolean;
  name?: string;
  email?: string;
  phone?: string;
}

export interface Charge {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  livemode: boolean;
}

/** Charge intent returned from presentCheckout / presentCart */
export interface ChargeIntent {
  id: string;
  currency: string;
  amount: number;
  status: ChargeIntentStatus;
  created: number;
  updated: number;
  livemode: boolean;
  object: string;
  description?: string;
  authorizationMode?: AuthorizationMode;
  failureDescription?: string;
  customer?: Customer;
  paymentMethod?: PaymentMethod;
  latestCharge?: Charge;
  shipping?: BillingAddress;
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

/** Identifies who the Apple Pay payment method belongs to. */
export type ApplePayOwner =
  | { type: 'customer'; id: string }
  | { type: 'account'; id: string };

/** Options for Frame.presentApplePay. */
export interface PresentApplePayOptions {
  /** Payment amount in cents. */
  amount: number;
  /** ISO 4217 currency code. Defaults to 'usd'. */
  currency?: string;
  /** Customer or account that owns the resulting payment method. */
  owner: ApplePayOwner;
  /** Apple Pay merchant ID configured in your Apple Developer account. */
  merchantId: string;
}

/** Options for Frame.presentGooglePay. */
export interface PresentGooglePayOptions {
  /** Payment amount in cents. */
  amountCents: number;
  /** Optional Frame customer ID to associate the resulting payment method with. */
  customerId?: string | null;
  /** ISO 4217 currency code. Defaults to 'USD'. */
  currencyCode?: string;
  /** Optional override for the Google Pay merchant ID. */
  googlePayMerchantId?: string;
}
