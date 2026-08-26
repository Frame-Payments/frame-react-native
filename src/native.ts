/**
 * Native module bridge. Uses NativeModules for classic React Native bridge.
 */

import { NativeModules, Platform } from 'react-native';
import type {
  AddMethodResult,
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

let isInitialized = false;

export function initialize(options: {
  /**
   * Frame publishable key (`pk_…`). The preferred, publishable-key-first way to
   * initialize the SDK.
   */
  publishableKey: string;
  /**
   * Frame secret key (`sk_…`). Optional as of Frame-iOS 4.x and frame-android
   * 3.x — prefer shipping only the publishable key in your app.
   */
  secretKey?: string;
  debugMode?: boolean;
  /**
   * Apple Pay merchant ID configured in your Apple Developer account. Applied to every
   * Apple Pay surface (presentApplePay, the bundled checkout's wallet row, the
   * onboarding wallet attach button). iOS-only — ignored on Android.
   */
  applePayMerchantId?: string;
  /**
   * Google Pay merchant ID from the Google Pay & Wallet Console. Applied to every
   * Google Pay surface (presentGooglePay, the bundled checkout's wallet row, the
   * onboarding wallet attach button). Android-only — ignored on iOS.
   */
  googlePayMerchantId?: string;
  /**
   * Optional theme applied SDK-wide to Frame's reusable components (checkout,
   * cart, onboarding) on both iOS and Android. Pass any subset — unspecified
   * tokens fall back to SDK defaults.
   */
  theme?: FrameTheme;
}): Promise<void> {
  if (!options?.publishableKey) {
    throwCoded(ErrorCodes.INIT_FAILED, 'Frame.initialize requires publishableKey');
  }
  if (options.theme !== undefined && (typeof options.theme !== 'object' || Array.isArray(options.theme))) {
    throwCoded(ErrorCodes.INIT_FAILED, 'Frame.initialize: theme must be an object');
  }
  return wrapPromise(
    FrameSDK.initialize(
      options.secretKey ?? null,
      options.publishableKey,
      options.debugMode ?? false,
      options.applePayMerchantId ?? null,
      options.googlePayMerchantId ?? null,
      options.theme ?? null
    )
  ).then(() => {
    isInitialized = true;
  });
}

function guardInitialized(): void {
  if (!isInitialized) {
    const message =
      'Frame SDK must be initialized before calling presentCheckout, presentCart, or presentOnboarding. Call Frame.initialize({ publishableKey }) first.';
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
 *
 * `accountId` is required: the bundled checkout creates a `Transfer`, which is
 * account-scoped. Callers needing a customer/ChargeIntent flow should use
 * `presentApplePay` / `presentGooglePay` directly with a customer owner.
 */
export function presentCheckout(options: {
  accountId: string;
  amount: number;
}): Promise<string> {
  guardInitialized();
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentCheckout requires accountId');
  }
  return wrapPromise(
    FrameSDK.presentCheckout(options.accountId, options.amount)
  );
}

/**
 * Presents the Frame cart UI; tapping checkout routes through the same flow
 * as `presentCheckout` and resolves with the created Transfer's id string.
 *
 * `accountId` is required for the same reason as `presentCheckout`.
 */
export function presentCart(options: {
  accountId: string;
  items: FrameCartItem[];
  shippingAmountInCents: number;
}): Promise<string> {
  guardInitialized();
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentCart requires accountId');
  }
  return wrapPromise(
    FrameSDK.presentCart(
      options.accountId,
      options.items,
      options.shippingAmountInCents
    )
  );
}

export function presentOnboarding(options: {
  accountId?: string | null;
  capabilities?: OnboardingCapability[];
  showIntroScreen?: boolean;
  showCompletionScreen?: boolean;
  /**
   * Onboarding session client secret (`onb_sess_…`) minted server-side via
   * `POST /v1/onboarding_sessions`. When provided, the onboarding flow
   * authenticates with this session instead of the legacy secret-key path.
   */
  clientSecret?: string | null;
}): Promise<OnboardingResult> {
  guardInitialized();
  return wrapPromise(
    FrameSDK.presentOnboarding(
      options.accountId ?? null,
      options.capabilities ?? [],
      options.showIntroScreen ?? true,
      options.showCompletionScreen ?? true,
      options.clientSecret ?? null
    )
  );
}

/**
 * Presents a standalone "add a payment method" screen, outside the onboarding flow.
 * Use this to prompt an existing user to add a card at an arbitrary point in your app.
 *
 * iOS-only for now — frame-android has no standalone equivalent yet; use
 * `presentOnboarding` with `card_verification` on Android.
 */
export function presentAddPaymentMethod(options: {
  accountId: string;
  /**
   * Onboarding session client secret (`onb_sess_…`) minted server-side via
   * `POST /v1/onboarding_sessions`, scoping the request to `accountId`. Omit this
   * only for legacy integrations that still authenticate with a secret key.
   */
  clientSecret?: string | null;
}): Promise<AddMethodResult> {
  guardInitialized();
  if (Platform.OS !== 'ios') {
    throwCoded('PLATFORM_UNSUPPORTED', 'Frame.presentAddPaymentMethod is iOS-only.');
  }
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentAddPaymentMethod requires accountId');
  }
  return wrapPromise(
    FrameSDK.presentAddPaymentMethod(options.accountId, options.clientSecret ?? null)
  );
}

/**
 * Presents a standalone "add a payout bank account" screen, outside the onboarding flow.
 * Use this to prompt an existing user to add a payout account at an arbitrary point in your app.
 *
 * iOS-only for now — frame-android has no standalone equivalent yet; use
 * `presentOnboarding` with `bank_account_verification` on Android.
 */
export function presentAddPayoutMethod(options: {
  accountId: string;
  /**
   * Onboarding session client secret (`onb_sess_…`) minted server-side via
   * `POST /v1/onboarding_sessions`, scoping the request to `accountId`. Omit this
   * only for legacy integrations that still authenticate with a secret key.
   */
  clientSecret?: string | null;
}): Promise<AddMethodResult> {
  guardInitialized();
  if (Platform.OS !== 'ios') {
    throwCoded('PLATFORM_UNSUPPORTED', 'Frame.presentAddPayoutMethod is iOS-only.');
  }
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentAddPayoutMethod requires accountId');
  }
  return wrapPromise(
    FrameSDK.presentAddPayoutMethod(options.accountId, options.clientSecret ?? null)
  );
}

/**
 * Presents a standalone "choose the primary payout account" screen, outside the
 * onboarding flow. Lists the account's saved ACH payout methods, lets the user add a
 * new one, and elects the chosen method as the account's payout destination.
 *
 * Where {@link presentAddPayoutMethod} only adds a bank, this also makes it primary.
 * On success `methodId` is the newly *elected* payout method. Requires frame-ios 4.4.1+.
 *
 * iOS-only — frame-android has no standalone equivalent yet.
 */
export function presentSelectPayoutMethod(options: {
  accountId: string;
  /**
   * Onboarding session client secret (`onb_sess_…`) minted server-side via
   * `POST /v1/onboarding_sessions`, scoping the request to `accountId`. Electing a
   * payout method requires a caller scoped to the account, so a publishable key is
   * rejected. Omit this only for legacy integrations that authenticate with a secret key.
   */
  clientSecret?: string | null;
}): Promise<AddMethodResult> {
  guardInitialized();
  if (Platform.OS !== 'ios') {
    throwCoded('PLATFORM_UNSUPPORTED', 'Frame.presentSelectPayoutMethod is iOS-only.');
  }
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentSelectPayoutMethod requires accountId');
  }
  return wrapPromise(
    FrameSDK.presentSelectPayoutMethod(options.accountId, options.clientSecret ?? null)
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
  if (Platform.OS !== 'ios') {
    throwCoded('PLATFORM_UNSUPPORTED', 'Frame.presentApplePay is iOS-only; use presentGooglePay on Android.');
  }
  if (!options?.owner || (options.owner.type !== 'customer' && options.owner.type !== 'account')) {
    throwCoded(ErrorCodes.INVALID_OWNER, 'Frame.presentApplePay requires owner: { type: "customer" | "account", id: string }');
  }
  if (!options.owner.id) {
    throwCoded(ErrorCodes.INVALID_OWNER, 'Frame.presentApplePay requires owner.id');
  }
  return wrapPromise(
    FrameSDK.presentApplePay(
      options.owner.type,
      options.owner.id,
      options.amount,
      options.currency ?? 'usd'
    )
  );
}

/**
 * Presents Google Pay and creates a charge from the resulting wallet payment method.
 * Resolves with the created resource's id string on success.
 *
 *  - `owner.type === 'customer'` → creates a `ChargeIntent`; resolves with its id.
 *  - `owner.type === 'account'`  → creates a `Transfer`;     resolves with its id.
 */
export function presentGooglePay(options: PresentGooglePayOptions): Promise<string> {
  guardInitialized();
  if (Platform.OS !== 'android') {
    throwCoded('PLATFORM_UNSUPPORTED', 'Frame.presentGooglePay is Android-only; use presentApplePay on iOS.');
  }
  if (!options?.owner || (options.owner.type !== 'customer' && options.owner.type !== 'account')) {
    throwCoded(ErrorCodes.INVALID_OWNER, 'Frame.presentGooglePay requires owner: { type: "customer" | "account", id: string }');
  }
  if (!options.owner.id) {
    throwCoded(ErrorCodes.INVALID_OWNER, 'Frame.presentGooglePay requires owner.id');
  }
  return wrapPromise(
    FrameSDK.presentGooglePay(
      options.amountCents,
      options.owner.type,
      options.owner.id,
      options.currencyCode ?? 'USD'
    )
  );
}

/**
 * Clears the device's stored App Attest key and re-attests against the backend.
 *
 * App Attest keys persist in the iOS keychain across app reinstalls, so a key
 * attested against a stale backend environment keeps being presented until it is
 * explicitly reset — deleting the app does not clear it. Call this to force a
 * fresh attestation (generate key → challenge → attest → verify → persist).
 *
 * iOS-only; resolves once re-attestation completes. Rejects with
 * `ATTESTATION_FAILED` if the backend flow fails — the old key is already gone
 * by then, so the device stays unattested and wallet payments reject with
 * `NOT_ATTESTED` until a later attestation succeeds. Retry rather than ignoring
 * the rejection.
 */
export function resetDeviceAttestation(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throwCoded('PLATFORM_UNSUPPORTED', 'Frame.resetDeviceAttestation is iOS-only.');
  }
  return wrapPromise(FrameSDK.resetDeviceAttestation());
}
