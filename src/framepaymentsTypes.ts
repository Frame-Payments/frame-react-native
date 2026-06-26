/**
 * Local mirror of the **wire-shape** payment-method types from the
 * `framepayments` npm SDK (snake_case `exp_month`, `last_four`, `Address`).
 *
 * NOTE: this is distinct from `src/types.ts`, which defines the **public,
 * RN-facing** payment-method shapes (camelCase `expirationMonth`,
 * `lastFourDigits`, `BillingAddress`). The two model the same domain at
 * different layers and are deliberately not merged — this file matches what the
 * framepayments SDK sends/returns over the wire; `types.ts` is what Frame RN
 * consumers see.
 *
 * Why a local copy: until 2.3.x these were importable via the deep path
 * `framepayments/dist/types/payment_methods`. The 2.4.0 dual-build bundles
 * everything into one entry whose `exports` map exposes only the root, and the
 * bundled declarations re-export only the Apple/Google Pay types — NOT
 * `PaymentMethod` / `PaymentMethodType` / `PaymentAccountType`. So neither the
 * old deep import nor a top-level import resolves.
 *
 * Shapes are copied verbatim from framepayments@2.4.0's `dist/index.d.cts`.
 * TODO(FRA-4714): once frame-node exports these from its entry point, delete
 * this file and re-export the canonical types from `framepayments` instead.
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
