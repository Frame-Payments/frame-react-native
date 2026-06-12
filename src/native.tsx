import { NativeModules, Platform } from 'react-native';
import type {
  FrameCartItem,
  FrameTheme,
  OnboardingCapability,
  OnboardingResult,
  PresentApplePayOptions,
  PresentGooglePayOptions,
} from './types';
import { useEffect, useState } from 'react';
import { presentScreen } from './presenter';
import { CartScreen } from './ui/screens/cart/CartScreen';
import { CheckoutScreen } from './ui/screens/checkout/CheckoutScreen';
import type { AddressMode } from './ui/screens/checkout/checkoutReducer';
import { OnboardingRoot } from './ui/screens/onboarding/OnboardingRoot';
import { canMakeApplePay } from './applePay';
import { isGooglePayReady } from './googlePay';
import { ErrorCodes, frameError } from './errors';
import {
  setConfig,
  isInitialized as configIsInitialized,
  resetConfig,
  __internal,
  getDebugMode,
} from './config';
import { resetClients, warmClients, client } from './client';
import { configureEvervault, resetEvervault } from './evervault';
import { fetchIpAddress } from './ipAddress';
import { presentApplePayFlow } from './applePay';
import { presentGooglePayFlow } from './googlePay';

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

function throwCoded(code: string, message: string): never {
  throw frameError(code, message);
}

/**
 * Initializes the Frame SDK. Must be called once — before any `present*`
 * function — typically at app startup or immediately after the user signs in.
 *
 * Under the hood this:
 * 1. Validates the provided keys.
 * 2. Passes credentials to the native bridge (iOS / Android).
 * 3. Warms the JS-side HTTP client.
 * 4. Prefetches Evervault and Sift configurations in the background so
 *    card encryption is ready by the time the checkout sheet opens.
 *
 * Calling `initialize` a second time with different credentials re-initializes
 * the SDK. Any prior native state is reset before the new credentials take
 * effect.
 *
 * @param options - SDK initialization options.
 * @param options.secretKey - Your Frame secret key (`sk_...`).
 * @param options.publishableKey - Your Frame publishable key (`pk_...`).
 * @param options.debugMode - When `true`, emits verbose SDK logs to the console. Defaults to `false`.
 * @param options.applePayMerchantId - Apple Pay merchant identifier registered in the Apple Developer Portal.
 *   Required to enable Apple Pay in {@link presentCheckout} and {@link presentApplePay}.
 * @param options.googlePayMerchantId - Google Pay merchant identifier. Required to enable Google Pay
 *   in {@link presentCheckout} and {@link presentGooglePay}.
 * @param options.theme - Optional visual theme applied to all Frame-managed UI surfaces.
 *
 * @throws {FrameErrorShape} `INIT_FAILED` if `secretKey` or `publishableKey` is missing,
 *   `theme` is not a plain object, or the native bridge fails to initialize.
 *
 * @example
 * ```ts
 * import Frame from 'framepayments-react-native';
 *
 * await Frame.initialize({
 *   secretKey: 'sk_test_...',
 *   publishableKey: 'pk_test_...',
 *   applePayMerchantId: 'merchant.com.example',
 * });
 * ```
 */
export function initialize(options: {
  secretKey: string;
  publishableKey: string;
  debugMode?: boolean;
  applePayMerchantId?: string;
  googlePayMerchantId?: string;
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
  return runInitialize(options);
}

// Defer JS-side config + framepayments client warming until the native bridge
// resolves. A successful resolve means the native side is ready; only then is
// it safe for parallel guardInitialized() calls to see initialized=true.
async function runInitialize(options: {
  secretKey: string;
  publishableKey: string;
  debugMode?: boolean;
  applePayMerchantId?: string;
  googlePayMerchantId?: string;
  theme?: FrameTheme;
}): Promise<void> {
  try {
    await wrapPromise(
      FrameSDK.initialize(
        options.secretKey,
        options.publishableKey,
        options.debugMode ?? false,
        options.applePayMerchantId ?? null,
        options.googlePayMerchantId ?? null,
        options.theme ?? null
      )
    );
  } catch (err) {
    resetConfig();
    resetClients();
    throw err;
  }

  resetClients();
  resetEvervault();
  setConfig({
    secretKey: options.secretKey,
    publishableKey: options.publishableKey,
    debugMode: options.debugMode ?? false,
    applePayMerchantId: options.applePayMerchantId,
    googlePayMerchantId: options.googlePayMerchantId,
    theme: options.theme,
  });
  warmClients();

  // Prefetch Evervault + Sift configs in the background. Card encryption can't
  // proceed until Evervault is configured, but we don't block initialize on it
  // — submit-time encryption will re-await this promise via configureEvervault's
  // memoization. Sift's bridge wiring lands in a later phase; we cache the
  // config now so it's ready when the bridge attaches.
  void prefetchServiceConfigs();
  // Resolve the device IP asynchronously and reset the cached SDK client so
  // subsequent requests pick up the ip_address header. iOS resolves
  // immediately (getifaddrs); Android does a one-time api.ipify.org lookup
  // that may take a few hundred ms — requests before it lands go out
  // without the header (matches the native Frame Android behavior).
  void prefetchIpAddress();
}

async function prefetchIpAddress(): Promise<void> {
  const ip = await fetchIpAddress();
  if (!ip) return;
  __internal.setIpAddress(ip);
  resetClients();
  warmClients();
}

async function prefetchServiceConfigs(): Promise<void> {
  // Fire both fetches in parallel — they're independent and the round-trips
  // saved matter for time-to-first-encrypt on slow connections.
  const [evResult, siftResult] = await Promise.allSettled([
    client.sdk.configuration.getEvervaultConfiguration(),
    client.sdk.configuration.getSiftConfiguration(),
  ]);

  if (evResult.status === 'fulfilled') {
    const ev = evResult.value;
    if (ev.team_id && ev.app_id) {
      __internal.setEvervaultConfiguration({ teamId: ev.team_id, appId: ev.app_id });
      try {
        await configureEvervault(ev.team_id, ev.app_id);
      } catch (err) {
        debugWarn('Evervault configure failed', err);
      }
    } else if (getDebugMode()) {
      console.warn('[Frame] Backend returned no Evervault config (team_id/app_id missing).');
    }
  } else {
    debugWarn('Evervault config prefetch failed', evResult.reason);
  }

  if (siftResult.status === 'fulfilled') {
    const sift = siftResult.value;
    if (sift.account_id && sift.beacon_key) {
      __internal.setSiftConfiguration({ accountId: sift.account_id, beaconKey: sift.beacon_key });
    } else if (getDebugMode()) {
      console.warn('[Frame] Backend returned no Sift config (account_id/beacon_key missing).');
    }
  } else {
    debugWarn('Sift config prefetch failed', siftResult.reason);
  }
}

function debugWarn(stage: string, err: unknown): void {
  if (!getDebugMode()) return;
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[Frame] ${stage}: ${message}`);
}

function guardInitialized(): void {
  if (!configIsInitialized()) {
    throw frameError(
      ErrorCodes.NOT_INITIALIZED,
      'Frame SDK must be initialized before calling presentCheckout, presentCart, or presentOnboarding. Call Frame.initialize({ secretKey, publishableKey }) first.',
    );
  }
}

function wrapPromise<T>(p: Promise<T>): Promise<T> {
  return p.catch((err) => {
    // RN bridge rejections already carry { code, message, nativeError }.
    // Pass them through; rebuild only when the shape is wrong.
    if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw frameError('UNKNOWN_ERROR', message);
  });
}

/**
 * Options for {@link presentCheckout}.
 */
export interface PresentCheckoutOptions {
  /** Frame account ID to charge. */
  accountId: string;
  /** Charge amount in the smallest currency unit (e.g. cents for USD). */
  amount: number;
  /** ISO 4217 currency code. Defaults to `'USD'` when omitted. */
  currency?: string;
  /**
   * Controls whether a billing address is collected during checkout.
   * - `'required'` — address fields are shown and must be filled (default).
   * - `'optional'` — address fields are shown but can be skipped.
   * - `'hidden'` — address collection is suppressed entirely.
   */
  addressMode?: AddressMode;
  /** Custom title shown in the checkout sheet header. Defaults to `'Checkout'`. */
  title?: string;
}

/**
 * Presents the Frame checkout sheet modally and resolves with the charge ID
 * on success. The sheet handles card entry, saved payment methods, Apple Pay
 * (iOS), and Google Pay (Android).
 *
 * {@link initialize} must be called before `presentCheckout`.
 *
 * @param options - Checkout configuration.
 * @returns A promise that resolves to the Frame charge ID string.
 * @throws {FrameErrorShape} `USER_CANCELED` if the user dismisses the sheet;
 *   `NOT_INITIALIZED` if {@link initialize} was not called first;
 *   `INVALID_ACCOUNT` if `accountId` is missing.
 *
 * @example
 * ```ts
 * const chargeId = await Frame.presentCheckout({
 *   accountId: 'acc_...',
 *   amount: 2500,        // $25.00
 *   currency: 'USD',
 * });
 * ```
 */
export async function presentCheckout(options: PresentCheckoutOptions): Promise<string> {
  guardInitialized();
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentCheckout requires accountId');
  }
  const [applePayReady, googlePayReady] = await Promise.all([
    Platform.OS === 'ios' ? canMakeApplePay() : Promise.resolve(false),
    Platform.OS === 'android' ? isGooglePayReady() : Promise.resolve(false),
  ]);

  return presentScreen<string>((api) => (
    <CheckoutScreen
      accountId={options.accountId}
      amount={options.amount}
      currency={options.currency}
      addressMode={options.addressMode}
      title={options.title}
      showApplePay={applePayReady}
      showGooglePay={googlePayReady}
      onSuccess={(id) => api.complete(id)}
      onClose={() => api.cancel()}
      onFail={(err) => api.fail(err)}
    />
  ));
}

/**
 * Options for {@link presentCart}.
 */
export interface PresentCartOptions {
  /** Frame account ID to charge. */
  accountId: string;
  /** Line items displayed in the cart review screen. */
  items: FrameCartItem[];
  /** Shipping cost in the smallest currency unit (e.g. cents for USD). Added to the item total. */
  shippingAmountInCents: number;
  /** ISO 4217 currency code. Defaults to `'USD'` when omitted. */
  currency?: string;
  /** Custom title shown in the cart sheet header. */
  title?: string;
  /**
   * Controls whether a billing address is collected at checkout.
   * See {@link PresentCheckoutOptions.addressMode} for values.
   */
  addressMode?: AddressMode;
}

/**
 * Presents a cart review sheet followed by the checkout sheet. The user can
 * review line items and shipping before proceeding to payment. Resolves with
 * the charge ID on success.
 *
 * {@link initialize} must be called before `presentCart`.
 *
 * @param options - Cart and checkout configuration.
 * @returns A promise that resolves to the Frame charge ID string.
 * @throws {FrameErrorShape} `USER_CANCELED` if the user dismisses the sheet;
 *   `NOT_INITIALIZED` if {@link initialize} was not called first;
 *   `INVALID_ACCOUNT` if `accountId` is missing.
 *
 * @example
 * ```ts
 * const chargeId = await Frame.presentCart({
 *   accountId: 'acc_...',
 *   items: [{ id: 'item_1', title: 'T-Shirt', amountInCents: 2000, imageUrl: 'https://...' }],
 *   shippingAmountInCents: 500,
 * });
 * ```
 */
export async function presentCart(options: PresentCartOptions): Promise<string> {
  guardInitialized();
  if (!options?.accountId) {
    throwCoded(ErrorCodes.INVALID_ACCOUNT, 'Frame.presentCart requires accountId');
  }
  // Cart screen sums items + shipping, then transitions to Checkout for the
  // actual payment collection. The presenter only ever renders ONE screen at a
  // time, so the Cart's "Checkout" button swaps the rendered element via a
  // local React state held by a small bridge component.
  return presentScreen<string>((api) => (
    <CartCheckoutBridge
      cartOptions={options}
      onComplete={(id) => api.complete(id)}
      onCancel={() => api.cancel()}
      onFail={(err) => api.fail(err)}
    />
  ));
}

/**
 * Options for {@link presentOnboarding}.
 */
export interface PresentOnboardingOptions {
  /**
   * An existing Frame account ID to onboard against. When omitted (or `null`),
   * Frame creates a new account automatically and returns its ID in
   * {@link OnboardingResult.accountId}.
   */
  accountId?: string | null;
  /**
   * Capabilities to verify during onboarding. The SDK reconciles this list
   * with the capabilities already on the account — requesting only what is
   * still outstanding. Defaults to `[]` (no specific capabilities required).
   */
  capabilities?: OnboardingCapability[];
  /** Show the intro/welcome screen before the first onboarding step. Defaults to `true`. */
  showIntroScreen?: boolean;
  /** Show the completion/success screen after all steps finish. Defaults to `true`. */
  showCompletionScreen?: boolean;
}

/**
 * Presents the Frame onboarding flow to verify a user's identity and
 * capabilities (KYC, bank-account linkage, etc.). Resolves with an
 * {@link OnboardingResult} indicating whether the user completed or cancelled
 * the flow.
 *
 * {@link initialize} must be called before `presentOnboarding`.
 *
 * @param options - Onboarding configuration.
 * @returns A promise that resolves to an {@link OnboardingResult}.
 *
 * @example
 * ```ts
 * const result = await Frame.presentOnboarding({
 *   accountId: 'acc_...',
 *   capabilities: ['kyc', 'bank_account_verification'],
 * });
 * if (result.status === 'completed') {
 *   console.log('Onboarded account:', result.accountId);
 * }
 * ```
 */
export async function presentOnboarding(options: PresentOnboardingOptions): Promise<OnboardingResult> {
  guardInitialized();
  const accountId = options.accountId ?? null;
  const capabilities = options.capabilities ?? [];
  const showIntroScreen = options.showIntroScreen ?? true;
  const showCompletionScreen = options.showCompletionScreen ?? true;
  return presentScreen<OnboardingResult>((api) => (
    <OnboardingRoot
      accountId={accountId}
      capabilities={capabilities}
      showIntroScreen={showIntroScreen}
      showCompletionScreen={showCompletionScreen}
      onComplete={(result) => api.complete(result)}
      onCancel={() => api.cancel()}
      onFail={(err) => api.fail(err)}
    />
  ));
}

function CartCheckoutBridge({
  cartOptions,
  onComplete,
  onCancel,
  onFail,
}: {
  cartOptions: PresentCartOptions;
  onComplete: (id: string) => void;
  onCancel: () => void;
  onFail: (err: unknown) => void;
}) {
  const [stage, setStage] = useState<'cart' | 'checkout'>('cart');
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ap, gp] = await Promise.all([
        Platform.OS === 'ios' ? canMakeApplePay() : Promise.resolve(false),
        Platform.OS === 'android' ? isGooglePayReady() : Promise.resolve(false),
      ]);
      if (cancelled) return;
      setApplePayReady(ap);
      setGooglePayReady(gp);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalCents =
    cartOptions.items.reduce((sum, i) => sum + i.amountInCents, 0) +
    cartOptions.shippingAmountInCents;

  if (stage === 'cart') {
    return (
      <CartScreen
        items={cartOptions.items}
        shippingAmountInCents={cartOptions.shippingAmountInCents}
        currency={cartOptions.currency}
        title={cartOptions.title}
        onCheckout={() => setStage('checkout')}
        onClose={onCancel}
      />
    );
  }

  return (
    <CheckoutScreen
      accountId={cartOptions.accountId}
      amount={totalCents}
      currency={cartOptions.currency}
      addressMode={cartOptions.addressMode}
      title="Checkout"
      showApplePay={applePayReady}
      showGooglePay={googlePayReady}
      onSuccess={onComplete}
      onClose={() => setStage('cart')}
      onFail={onFail}
    />
  );
}

/**
 * Presents the native Apple Pay sheet and charges the provided amount.
 * Resolves with a ChargeIntent ID when `owner.type === 'customer'` or a
 * Transfer ID when `owner.type === 'account'`.
 *
 * iOS only — on Android the promise rejects immediately with
 * `APPLE_PAY_UNAVAILABLE`. Use {@link isAttestationSupported} / platform
 * checks to gate the UI before calling.
 *
 * {@link initialize} must be called (with `applePayMerchantId`) before
 * `presentApplePay`.
 *
 * @param options - Apple Pay charge options.
 * @returns A promise that resolves to a charge or transfer ID string.
 * @throws {FrameErrorShape} `USER_CANCELED` if the user cancels;
 *   `APPLE_PAY_UNAVAILABLE` if Apple Pay is not available;
 *   `INVALID_MERCHANT_ID` if no merchant ID was supplied to {@link initialize}.
 *
 * @example
 * ```ts
 * const id = await Frame.presentApplePay({
 *   amount: 1500,
 *   owner: { type: 'customer', id: 'cus_...' },
 * });
 * ```
 */
export function presentApplePay(options: PresentApplePayOptions): Promise<string> {
  guardInitialized();
  return presentApplePayFlow(options);
}

/**
 * Presents the native Google Pay sheet and charges the provided amount.
 * Resolves with a ChargeIntent ID when `owner.type === 'customer'` or a
 * Transfer ID when `owner.type === 'account'`.
 *
 * Android only — on iOS the promise rejects immediately with
 * `GOOGLE_PAY_UNAVAILABLE`. Use platform checks to gate the UI before calling.
 *
 * {@link initialize} must be called (with `googlePayMerchantId`) before
 * `presentGooglePay`.
 *
 * @param options - Google Pay charge options.
 * @returns A promise that resolves to a charge or transfer ID string.
 * @throws {FrameErrorShape} `USER_CANCELED` if the user cancels;
 *   `GOOGLE_PAY_UNAVAILABLE` if Google Pay is not available;
 *   `INVALID_MERCHANT_ID` if no merchant ID was supplied to {@link initialize}.
 *
 * @example
 * ```ts
 * const id = await Frame.presentGooglePay({
 *   amountCents: 1500,
 *   owner: { type: 'customer', id: 'cus_...' },
 * });
 * ```
 */
export function presentGooglePay(options: PresentGooglePayOptions): Promise<string> {
  guardInitialized();
  return presentGooglePayFlow(options);
}
