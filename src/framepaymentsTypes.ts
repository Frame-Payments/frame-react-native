/**
 * Local mirror of the payment-method types from the `framepayments` npm SDK.
 *
 * Until 2.3.x, these were importable via the deep path
 * `framepayments/dist/types/payment_methods`. The 2.4.0 dual-build bundles
 * everything into a single entry and the package's `exports` map exposes only
 * the root — and the bundled declarations re-export only the Apple/Google Pay
 * types, NOT `PaymentMethod` / `PaymentMethodType` / `PaymentAccountType`. So
 * neither the old deep import nor a top-level import resolves.
 *
 * These shapes are copied verbatim from framepayments@2.4.0's bundled
 * declarations (`dist/index.d.cts`). They are a public part of the SDK surface
 * (the return type of `paymentMethods.createCard` / `.createACH`), so a
 * follow-up should add them to frame-node's entry-point exports and let this
 * module re-export from `framepayments` instead — see FRA follow-up.
 */

export enum PaymentAccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
}

export enum PaymentMethodType {
  CARD = 'card',
  ACH = 'ach',
}

export enum PaymentMethodStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
  DETACHED = 'detached',
}

export interface Address {
  line_1?: string;
  line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

export interface PaymentCard {
  brand: string;
  exp_month: string;
  exp_year: string;
  issuer?: string;
  currency?: string;
  segment?: string;
  type?: string;
  last_four: string;
}

export interface BankAccount {
  account_type?: PaymentAccountType;
  account_number?: string;
  routing_number?: string;
  last_four?: string;
  bank_name?: string;
}

export interface PaymentMethod {
  id: string;
  object?: string;
  customer?: string | null;
  account_id?: string | null;
  billing?: Address;
  type: string;
  livemode: boolean;
  created: number;
  updated?: number;
  status?: PaymentMethodStatus;
  card?: PaymentCard;
  ach?: BankAccount;
}
