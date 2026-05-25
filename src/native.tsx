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

export interface PresentCheckoutOptions {
  accountId: string;
  amount: number;
  currency?: string;
  addressMode?: AddressMode;
  title?: string;
}

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

export interface PresentCartOptions {
  accountId: string;
  items: FrameCartItem[];
  shippingAmountInCents: number;
  currency?: string;
  title?: string;
  addressMode?: AddressMode;
}

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

export interface PresentOnboardingOptions {
  accountId?: string | null;
  capabilities?: OnboardingCapability[];
}

export async function presentOnboarding(options: PresentOnboardingOptions): Promise<OnboardingResult> {
  guardInitialized();
  const accountId = options.accountId ?? null;
  const capabilities = options.capabilities ?? [];
  return presentScreen<OnboardingResult>((api) => (
    <OnboardingRoot
      accountId={accountId}
      capabilities={capabilities}
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

export function presentApplePay(options: PresentApplePayOptions): Promise<string> {
  guardInitialized();
  return presentApplePayFlow(options);
}

export function presentGooglePay(options: PresentGooglePayOptions): Promise<string> {
  guardInitialized();
  return presentGooglePayFlow(options);
}
