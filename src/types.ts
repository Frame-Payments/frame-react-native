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

/** Charge intent returned from presentCheckout / presentCart */
export interface ChargeIntent {
  id: string;
  currency: string;
  amount: number;
  status: string;
  created: number;
  updated: number;
  livemode: boolean;
  object: string;
  description?: string;
  customer?: Record<string, unknown>;
  payment_method?: Record<string, unknown>;
  latest_charge?: Record<string, unknown>;
  authorization_mode?: string;
  failure_description?: string;
  shipping?: Record<string, unknown>;
}

/** Error shape when native module rejects (same as FrameErrorShape from errors.ts) */
export interface FrameError {
  code: string;
  message: string;
  nativeError?: string;
}
