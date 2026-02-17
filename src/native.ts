/**
 * Native module bridge. Uses NativeModules for classic React Native bridge.
 */

import { NativeModules } from 'react-native';
import type { ChargeIntent, FrameCartItem } from './types';
import { ErrorCodes } from './errors';

const LINKING_ERROR =
  `The package '@framepayments/react-native-frame' doesn't seem to be linked. Make sure you have run 'pod install' (iOS) or rebuilt the app (Android).`;

const FrameSDK = NativeModules.FrameSDK
  ? NativeModules.FrameSDK
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

let isInitialized = false;

export function initialize(options: { apiKey: string; debugMode?: boolean }): void {
  if (!options?.apiKey) {
    throw new Error('Frame.initialize requires apiKey');
  }
  FrameSDK.initialize(options.apiKey, options.debugMode ?? false);
  isInitialized = true;
}

function guardInitialized(): void {
  if (!isInitialized) {
    const message =
      'Frame SDK must be initialized before calling presentCheckout or presentCart. Call Frame.initialize({ apiKey }) first.';
    const err = new Error(message) as Error & { code: string };
    err.code = ErrorCodes.NOT_INITIALIZED;
    throw err;
  }
}

function wrapPromise<T>(p: Promise<T>): Promise<T> {
  return p.catch((err) => {
    let code = 'UNKNOWN_ERROR';
    let message = String(err?.message ?? err);
    if (err?.code) code = err.code;
    if (typeof err === 'object' && err !== null && 'message' in err) {
      message = String((err as { message: string }).message);
    }
    throw Object.assign(new Error(message), { code, message });
  });
}

export function presentCheckout(options: {
  customerId?: string | null;
  amount: number;
}): Promise<ChargeIntent> {
  guardInitialized();
  return wrapPromise(
    FrameSDK.presentCheckout(options.customerId ?? null, options.amount)
  );
}

export function presentCart(options: {
  customerId?: string | null;
  items: FrameCartItem[];
  shippingAmountInCents: number;
}): Promise<ChargeIntent> {
  guardInitialized();
  return wrapPromise(
    FrameSDK.presentCart(
      options.customerId ?? null,
      options.items,
      options.shippingAmountInCents
    )
  );
}
