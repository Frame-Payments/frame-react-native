/**
 * Native module bridge. Uses NativeModules for classic React Native bridge.
 */

import { NativeModules, Platform } from 'react-native';
import type {
  AddMethodResult,
  CheckoutClientSecret,
  FrameCartItem,
  FrameTheme,
  OnboardingCapability,
  OnboardingResult,
  PresentApplePayOptions,
  PresentGooglePayOptions,
} from './types';
import { ErrorCodes } from './errors';

// Tags the native SDKs' account events as this wrapper's; resolves from both src/ and lib/.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- package.json is outside rootDir, so it can't be imported
const PACKAGE_VERSION: string = require('../package.json').version;

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

function requireClientSecret(clientSecret: string | null | undefined, method: string): string {
  if (typeof clientSecret !== 'string' || clientSecret.trim() === '') {
    throwCoded(
      ErrorCodes.INVALID_CLIENT_SECRET,
      `Frame.${method} requires clientSecret (onb_sess_… from POST /v1/onboarding_sessions)`
    );
  }
  return clientSecret;
}

function normalizeCheckoutClientSecret(
  checkoutClientSecret: CheckoutClientSecret | null | undefined,
  method: string
): CheckoutClientSecret {
  if (checkoutClientSecret == null) {
    throwCoded(
      ErrorCodes.INVALID_CLIENT_SECRET,
      `Frame.${method} requires checkoutClientSecret (chk_sess_… from POST /v1/checkout_sessions)`
    );
  }
  if (
    typeof checkoutClientSecret !== 'object' ||
    Array.isArray(checkoutClientSecret) ||
    typeof checkoutClientSecret.clientSecret !== 'string' ||
    checkoutClientSecret.clientSecret.trim() === '' ||
    typeof checkoutClientSecret.expiresAt !== 'number' ||
    !Number.isFinite(checkoutClientSecret.expiresAt)
  ) {
    throwCoded(
      ErrorCodes.INVALID_CLIENT_SECRET,
      `Frame.${method}: checkoutClientSecret requires { clientSecret: string, expiresAt: number }`
    );
  }
  const normalized: CheckoutClientSecret = {
    clientSecret: checkoutClientSecret.clientSecret,
    expiresAt: checkoutClientSecret.expiresAt,
  };
  if (
    checkoutClientSecret.amountCents !== undefined &&
    (typeof checkoutClientSecret.amountCents !== 'number' ||
      !Number.isFinite(checkoutClientSecret.amountCents))
  ) {
    throwCoded(
      ErrorCodes.INVALID_CLIENT_SECRET,
      `Frame.${method}: checkoutClientSecret.amountCents must be a finite number when set`
    );
  }
  if (
    checkoutClientSecret.amountCurrency !== undefined &&
    typeof checkoutClientSecret.amountCurrency !== 'string'
  ) {
    throwCoded(
      ErrorCodes.INVALID_CLIENT_SECRET,
      `Frame.${method}: checkoutClientSecret.amountCurrency must be a string when set`
    );
  }
  if (checkoutClientSecret.amountCents !== undefined) {
    normalized.amountCents = checkoutClientSecret.amountCents;
  }
  if (checkoutClientSecret.amountCurrency !== undefined) {
    normalized.amountCurrency = checkoutClientSecret.amountCurrency;
  }
  return normalized;
}

function requireAccountWalletOwner(
  owner: { type: string; id: string } | undefined,
  method: string
): { type: 'account'; id: string } {
  if (!owner || (owner.type !== 'customer' && owner.type !== 'account')) {
    throwCoded(
      ErrorCodes.INVALID_OWNER,
      `Frame.${method} requires owner: { type: "account", id: string }`
    );
  }
  if (!owner.id) {
    throwCoded(ErrorCodes.INVALID_OWNER, `Frame.${method} requires owner.id`);
  }
  // Transfers V2: wallet charges are account-scoped only (no ChargeIntent path).
  if (owner.type === 'customer') {
    throwCoded(
      ErrorCodes.INVALID_OWNER,
      `Frame.${method} charges require owner.type "account" (customer charges were removed with Transfers V2)`
    );
  }
  return { type: 'account', id: owner.id };
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
  /**
   * The Frame account this app run belongs to, when your app already knows it at
   * launch (e.g. a signed-in user). The Sonar fraud-detection session is then created
   * already bound to the account, so one session covers the whole app run instead of
   * an unscoped one being created and bound on first flow entry.
   *
   * Omit it when the account isn't known yet — the session is created unscoped and
   * adopted onto the account later, keeping the same session ID either way. You still
   * pass accountId to each present* call regardless; this only affects session setup.
   */
  accountId?: string;
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
      options.theme ?? null,
      options.accountId ?? null,
      PACKAGE_VERSION
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
 * `accountId` is required: the bundled checkout creates a V2 Transfer, which is
 * account-scoped. `checkoutClientSecret` is required: frame-ios 4.7 /
 * frame-android 3.3 load the payer and saved cards only with a `chk_sess_` token.
 */
export function presentCheckout(options: {
  accountId: string;
  amount: number;
  /**
   * `chk_sess_…` token from `POST /v1/checkout_sessions`. Required. Checkout
   * loads name, email, and saved cards with it.
   */
  checkoutClientSecret: CheckoutClientSecret;
}): Promise<string> {
  guardInitialized();
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentCheckout requires accountId');
  }
  const checkoutClientSecret = normalizeCheckoutClientSecret(
    options.checkoutClientSecret,
    'presentCheckout'
  );
  return wrapPromise(
    FrameSDK.presentCheckout(options.accountId, options.amount, checkoutClientSecret)
  );
}

/**
 * Presents the Frame cart UI; tapping checkout routes through the same flow
 * as `presentCheckout` and resolves with the created Transfer's id string.
 *
 * `accountId` and `checkoutClientSecret` are required for the same reason as
 * `presentCheckout`.
 */
export function presentCart(options: {
  accountId: string;
  items: FrameCartItem[];
  shippingAmountInCents: number;
  /**
   * `chk_sess_…` token forwarded to the embedded checkout. Required. See
   * {@link presentCheckout}.
   */
  checkoutClientSecret: CheckoutClientSecret;
}): Promise<string> {
  guardInitialized();
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentCart requires accountId');
  }
  const checkoutClientSecret = normalizeCheckoutClientSecret(
    options.checkoutClientSecret,
    'presentCart'
  );
  return wrapPromise(
    FrameSDK.presentCart(
      options.accountId,
      options.items,
      options.shippingAmountInCents,
      checkoutClientSecret
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
   * `POST /v1/onboarding_sessions`. Required — the native SDKs no longer mint
   * a session from a publishable or secret key inside the flow.
   */
  clientSecret: string;
}): Promise<OnboardingResult> {
  guardInitialized();
  const clientSecret = requireClientSecret(options?.clientSecret, 'presentOnboarding');
  return wrapPromise(
    FrameSDK.presentOnboarding(
      options.accountId ?? null,
      options.capabilities ?? [],
      options.showIntroScreen ?? false,
      options.showCompletionScreen ?? true,
      clientSecret
    )
  );
}

/**
 * Presents a standalone "add a payment method" screen, outside the onboarding flow.
 * Use this to prompt an existing user to add a card at an arbitrary point in your app.
 */
export function presentAddPaymentMethod(options: {
  accountId: string;
  /**
   * Onboarding session client secret (`onb_sess_…`) minted server-side via
   * `POST /v1/onboarding_sessions`, scoping the request to `accountId`. Required.
   */
  clientSecret: string;
}): Promise<AddMethodResult> {
  guardInitialized();
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentAddPaymentMethod requires accountId');
  }
  const clientSecret = requireClientSecret(options.clientSecret, 'presentAddPaymentMethod');
  return wrapPromise(FrameSDK.presentAddPaymentMethod(options.accountId, clientSecret));
}

/**
 * Presents a standalone "add a payout bank account" screen, outside the onboarding flow.
 * Use this to prompt an existing user to add a payout account at an arbitrary point in your app.
 */
export function presentAddPayoutMethod(options: {
  accountId: string;
  /**
   * Onboarding session client secret (`onb_sess_…`) minted server-side via
   * `POST /v1/onboarding_sessions`, scoping the request to `accountId`. Required.
   */
  clientSecret: string;
}): Promise<AddMethodResult> {
  guardInitialized();
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentAddPayoutMethod requires accountId');
  }
  const clientSecret = requireClientSecret(options.clientSecret, 'presentAddPayoutMethod');
  return wrapPromise(FrameSDK.presentAddPayoutMethod(options.accountId, clientSecret));
}

/**
 * Presents a standalone "choose the primary payout account" screen, outside the
 * onboarding flow. Lists the account's saved ACH payout methods, lets the user add a
 * new one, and elects the chosen method as the account's payout destination.
 *
 * Where {@link presentAddPayoutMethod} only adds a bank, this also makes it primary.
 * On success `methodId` is the newly *elected* payout method.
 */
export function presentSelectPayoutMethod(options: {
  accountId: string;
  /**
   * Onboarding session client secret (`onb_sess_…`) minted server-side via
   * `POST /v1/onboarding_sessions`, scoping the request to `accountId`. Required —
   * electing a payout method is an account-scoped write.
   */
  clientSecret: string;
}): Promise<AddMethodResult> {
  guardInitialized();
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentSelectPayoutMethod requires accountId');
  }
  const clientSecret = requireClientSecret(options.clientSecret, 'presentSelectPayoutMethod');
  return wrapPromise(FrameSDK.presentSelectPayoutMethod(options.accountId, clientSecret));
}

/**
 * Presents the Apple Pay sheet and creates a V2 Transfer from the resulting
 * wallet payment method. Resolves with the Transfer id on success, or rejects
 * with `USER_CANCELED` if the sheet is dismissed.
 *
 * Charges require `owner.type === 'account'`. Customer owners are rejected —
 * ChargeIntents were removed with Transfers V2 (frame-ios 4.7 / frame-android 3.3).
 */
export function presentApplePay(options: PresentApplePayOptions): Promise<string> {
  guardInitialized();
  if (Platform.OS !== 'ios') {
    throwCoded('PLATFORM_UNSUPPORTED', 'Frame.presentApplePay is iOS-only; use presentGooglePay on Android.');
  }
  const owner = requireAccountWalletOwner(options?.owner, 'presentApplePay');
  return wrapPromise(
    FrameSDK.presentApplePay(owner.type, owner.id, options.amount, options.currency ?? 'usd')
  );
}

/**
 * Presents Google Pay and creates a V2 Transfer from the resulting wallet
 * payment method. Resolves with the Transfer id on success.
 *
 * Charges require `owner.type === 'account'`. Customer owners are rejected —
 * ChargeIntents were removed with Transfers V2 (frame-ios 4.7 / frame-android 3.3).
 */
export function presentGooglePay(options: PresentGooglePayOptions): Promise<string> {
  guardInitialized();
  if (Platform.OS !== 'android') {
    throwCoded('PLATFORM_UNSUPPORTED', 'Frame.presentGooglePay is Android-only; use presentApplePay on iOS.');
  }
  const owner = requireAccountWalletOwner(options?.owner, 'presentGooglePay');
  return wrapPromise(
    FrameSDK.presentGooglePay(
      options.amountCents,
      owner.type,
      owner.id,
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
