/**
 * Native module bridge. Uses NativeModules for classic React Native bridge.
 */

import { NativeModules, Platform } from 'react-native';
import type {
  FrameCartItem,
  FrameTheme,
  OnboardingCapability,
  OnboardingResult,
  PresentApplePayOptions,
  PresentGooglePayOptions,
} from './types';
import { ErrorCodes } from './errors';

/**
 * Throw a coded error from synchronous JS validation. Mirrors the `code`/`message`
 * shape that native rejections produce so consumers can catch `e.code === 'INVALID_*'`
 * uniformly.
 */
function throwCoded(code: string, message: string): never {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  throw err;
}

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
    throwCoded(ErrorCodes.INIT_FAILED, 'Frame.initialize requires secretKey');
  }
  if (!options?.publishableKey) {
    throwCoded(ErrorCodes.INIT_FAILED, 'Frame.initialize requires publishableKey');
  }
  if (options.theme !== undefined && (typeof options.theme !== 'object' || Array.isArray(options.theme))) {
    throwCoded(ErrorCodes.INIT_FAILED, 'Frame.initialize: theme must be an object');
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

/**
 * Presents the Frame checkout sheet for the given account. Resolves with the
 * created Transfer's id string on success, or rejects with `USER_CANCELED` if
 * the user dismisses the sheet.
 */
export function presentCheckout(options: {
  accountId?: string | null;
  amount: number;
}): Promise<string> {
  guardInitialized();
  return wrapPromise(
    FrameSDK.presentCheckout(options.accountId ?? null, options.amount)
  );
}

/**
 * Presents the Frame cart UI; tapping checkout routes through the same flow
 * as `presentCheckout` and resolves with the created Transfer's id string.
 */
export function presentCart(options: {
  accountId?: string | null;
  items: FrameCartItem[];
  shippingAmountInCents: number;
}): Promise<string> {
  guardInitialized();
  return wrapPromise(
    FrameSDK.presentCart(
      options.accountId ?? null,
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

/**
 * Presents the Apple Pay sheet and creates a charge from the resulting wallet
 * payment method. Resolves with the created resource's id string on success,
 * or rejects with `USER_CANCELED` if the sheet is dismissed.
 *
 *  - `owner.type === 'customer'` → creates a `ChargeIntent`; resolves with its id.
 *  - `owner.type === 'account'`  → creates a `Transfer`;     resolves with its id.
 */
export function presentApplePay(options: PresentApplePayOptions): Promise<string> {
  guardInitialized();
  if (!options?.owner || (options.owner.type !== 'customer' && options.owner.type !== 'account')) {
    throwCoded(ErrorCodes.INVALID_OWNER, 'Frame.presentApplePay requires owner: { type: "customer" | "account", id: string }');
  }
  if (!options.owner.id) {
    throwCoded(ErrorCodes.INVALID_OWNER, 'Frame.presentApplePay requires owner.id');
  }
  if (!options.merchantId) {
    throwCoded(ErrorCodes.INVALID_MERCHANT_ID, 'Frame.presentApplePay requires merchantId');
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

/**
 * Presents Google Pay and creates a Transfer charged from the resulting wallet
 * payment method. Resolves with the created Transfer's id string on success.
 */
export function presentGooglePay(options: PresentGooglePayOptions): Promise<string> {
  guardInitialized();
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentGooglePay requires accountId');
  }
  return wrapPromise(
    FrameSDK.presentGooglePay(
      options.amountCents,
      options.accountId,
      options.currencyCode ?? 'USD',
      options.googlePayMerchantId ?? null
    )
  );
}
