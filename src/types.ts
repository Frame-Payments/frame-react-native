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
  customer?: Record<string, unknown>;
  paymentMethod?: PaymentMethod;
  latestCharge?: Record<string, unknown>;
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
