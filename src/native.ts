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

// theme is iOS-only today: frame-android does not yet have a matching theme API,
// so the field is accepted on both platforms but ignored on Android until it does.

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
  /**
   * Optional theme applied SDK-wide to Frame's reusable iOS components
   * (checkout, cart, onboarding). Pass any subset — unspecified tokens fall
   * back to SDK defaults. No-op on Android until frame-android ships a
   * matching theme API.
   */
  theme?: FrameTheme;
}): Promise<void> {
  if (!options?.secretKey) {
    throw new Error('Frame.initialize requires secretKey');
  }
  if (!options?.publishableKey) {
    throw new Error('Frame.initialize requires publishableKey');
  }
  if (options.theme !== undefined && (typeof options.theme !== 'object' || Array.isArray(options.theme))) {
    throw new Error('Frame.initialize: theme must be an object');
  }
  return wrapPromise(
    FrameSDK.initialize(
      options.secretKey,
      options.publishableKey,
      options.debugMode ?? false,
      options.theme ?? null
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
  googlePayMerchantId?: string | null;
}): Promise<OnboardingResult> {
  guardInitialized();
  if (Platform.OS === 'ios') {
    return wrapPromise(
      FrameSDK.presentOnboarding(
        options.accountId ?? null,
        options.capabilities ?? [],
        options.applePayMerchantId ?? null
      )
    );
  }
  return wrapPromise(
    FrameSDK.presentOnboarding(
      options.accountId ?? null,
      options.capabilities ?? [],
      options.googlePayMerchantId ?? null
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

