/**
 * Native module bridge. Uses NativeModules for classic React Native bridge.
 */

import { NativeModules, Platform } from 'react-native';
import type {
  ChargeIntent,
  FrameCartItem,
  FrameTheme,
  OnboardingCapability,
  OnboardingResult,
  PresentApplePayOptions,
  PresentGooglePayOptions,
} from './types';
import { ErrorCodes } from './errors';

const LINKING_ERROR =
  `The package 'framepayments-react-native' doesn't seem to be linked. Make sure you have run 'pod install' (iOS) or rebuilt the app (Android).`;

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

export function initialize(options: {
  secretKey: string;
  publishableKey: string;
  debugMode?: boolean;
}): Promise<void> {
  if (!options?.secretKey) {
    throw new Error('Frame.initialize requires secretKey');
  }
  if (!options?.publishableKey) {
    throw new Error('Frame.initialize requires publishableKey');
  }
  return wrapPromise(
    FrameSDK.initialize(
      options.secretKey,
      options.publishableKey,
      options.debugMode ?? false
    )
  ).then(() => {
    isInitialized = true;
  });
}

function guardInitialized(): void {
  if (!isInitialized) {
    const message =
      'Frame SDK must be initialized before calling presentCheckout, presentCart, or presentOnboarding. Call Frame.initialize({ apiKey }) first.';
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

export function presentOnboarding(options: {
  accountId?: string | null;
  capabilities?: OnboardingCapability[];
  applePayMerchantId?: string | null;
}): Promise<OnboardingResult> {
  guardInitialized();
  if (Platform.OS === 'ios' && options.applePayMerchantId) {
    return wrapPromise(
      FrameSDK.presentOnboardingWithApplePay(
        options.accountId ?? null,
        options.capabilities ?? [],
        options.applePayMerchantId
      )
    );
  }
  return wrapPromise(
    FrameSDK.presentOnboarding(
      options.accountId ?? null,
      options.capabilities ?? []
    )
  );
}

export function presentApplePay(options: PresentApplePayOptions): Promise<ChargeIntent> {
  guardInitialized();
  if (!options?.owner || (options.owner.type !== 'customer' && options.owner.type !== 'account')) {
    throw new Error('Frame.presentApplePay requires owner: { type: "customer" | "account", id: string }');
  }
  if (!options.owner.id) {
    throw new Error('Frame.presentApplePay requires owner.id');
  }
  if (!options.merchantId) {
    throw new Error('Frame.presentApplePay requires merchantId');
  }
  return wrapPromise(
    FrameSDK.presentApplePay(
      options.owner.type,
      options.owner.id,
      options.amount,
      options.currency ?? 'usd',
      options.merchantId
    )
  );
}

export function presentGooglePay(options: PresentGooglePayOptions): Promise<ChargeIntent> {
  guardInitialized();
  return wrapPromise(
    FrameSDK.presentGooglePay(
      options.amountCents,
      options.customerId ?? null,
      options.currencyCode ?? 'USD',
      options.googlePayMerchantId ?? null
    )
  );
}

/**
 * Configure colors, fonts, and corner radii for Frame's reusable iOS
 * components. Applied to every subsequent `present*` call; an in-flight modal
 * is not re-themed mid-flow.
 *
 * Pass `null` or `{}` to reset to SDK defaults. Android is a no-op until
 * frame-android ships a matching theme API.
 */
export function setTheme(theme: FrameTheme | null): Promise<void> {
  if (theme !== null && (typeof theme !== 'object' || Array.isArray(theme))) {
    throw new Error('Frame.setTheme requires a theme object or null');
  }
  if (Platform.OS !== 'ios') return Promise.resolve();
  return wrapPromise(FrameSDK.setTheme(theme ?? {}));
}
