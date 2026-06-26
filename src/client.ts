import { FrameSDK } from 'framepayments';
import { Platform } from 'react-native';
import { getIpAddress, getPublishableKey, getSecretKey } from './config';
import { getActiveOnboardingSession, __registerOnboardingSessionApplier } from './auth';
import { frameError, ErrorCodes } from './errors';
import { attachNetworkLogger, resetNetworkLogger } from './debug/networkLogger';

// Mirrors `version` in package.json. The native Android SDK builds its
// `Android/<version>` User-Agent from BuildConfig.SDK_VERSION at compile time;
// we don't have a runtime hook to read package.json (would require
// resolveJsonModule + dropping tsconfig rootDir, both of which leak into the
// compiled lib/ shape), so the value is duplicated here. `sdk-version.test.ts`
// fails CI if these drift, so a release bump that misses this file is caught
// before publish.
const SDK_VERSION = '4.0.4';

let sdk: FrameSDK | undefined;

function getClient(): FrameSDK {
  if (sdk) return sdk;
  const apiKey = getSecretKey();
  const publishableKey = getPublishableKey();
  if (!apiKey && !publishableKey) {
    throw frameError(
      ErrorCodes.NOT_INITIALIZED,
      'Frame SDK is not configured. Call Frame.initialize({ publishableKey }) first.',
    );
  }
  // Forward the device IP via the `ip_address` header on every request,
  // matching the native Frame iOS / Frame Android SDKs. Omitted when the
  // lookup hasn't completed yet — the next client construction (after
  // resetClients() in the IP-fetch resolver) will pick it up.
  const ip = getIpAddress();
  // Frame's backend routes requests through its native-SDK code path when the
  // User-Agent matches one of two patterns the native SDKs send:
  //   iOS:     literal "iOS"           (FrameNetworking.swift)
  //   Android: "Android/<sdk-version>" (FrameNetworking.kt — BuildConfig.SDK_VERSION)
  // Both PaymentMethodsController#native_sdk_request? and
  // WalletController#mobile_sdk_request? check these. The wallet controller's
  // check requires the slash on Android (`start_with?("Android/")`), so a bare
  // "Android" fails the Google Pay domain-bypass. Mirror the native Android
  // SDK exactly. SDK_VERSION must stay in sync with package.json; the
  // sdk-version.test.ts test fails if they drift.
  const userAgent =
    Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? `Android/${SDK_VERSION}` : undefined;
  const defaultHeaders: Record<string, string> = {};
  if (ip) defaultHeaders.ip_address = ip;
  if (userAgent) defaultHeaders['User-Agent'] = userAgent;
  sdk = new FrameSDK({
    apiKey,
    publishableKey,
    defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
  });
  attachNetworkLogger(sdk);
  // Re-apply any active onboarding session. The session token lives in the auth
  // module (not just on the SDK instance), so a resetClients() mid-flow — e.g.
  // the async IP-address prefetch landing while onboarding is open — rebuilds
  // this instance without dropping the session. Without this, account-scoped
  // onboarding requests would silently fall back to pk_/sk_.
  const session = getActiveOnboardingSession();
  if (session) sdk.setOnboardingSession(session);
  return sdk;
}

export function resetClients(): void {
  sdk = undefined;
  resetNetworkLogger();
}

// Returns the already-built SDK instance, or undefined if none has been
// constructed yet. Exposed for tests that assert the live session state.
export function peekClient(): FrameSDK | undefined {
  return sdk;
}

// Apply/clear the onboarding session on the live SDK instance the moment
// begin/endOnboardingSession is called. Future rebuilds re-read the token in
// getClient(), so this only needs to touch an already-built instance.
__registerOnboardingSessionApplier((token) => {
  if (!sdk) return;
  if (token) sdk.setOnboardingSession(token);
  else sdk.clearOnboardingSession();
});

export function warmClients(): boolean {
  if (!getSecretKey() && !getPublishableKey()) return false;
  getClient();
  return true;
}

// Throws a clear, coded error before a server-only (secret-keyed) operation
// when no secret key is configured. Money-movement endpoints (chargeIntents
// create, transfers create) are not yet publishable-key-routable on the
// backend, so a publishable-key-only app reaches them and would otherwise get
// framepayments' opaque `missing_api_key`. Fail with remediation instead.
export function requireSecretKeyFor(operation: string): void {
  if (getSecretKey()) return;
  throw frameError(
    ErrorCodes.MISSING_SECRET_KEY,
    `${operation} is a server-only operation that requires a secret key, which is not configured. ` +
      `On a publishable-key-only client, create the charge on your backend (sk_) — ` +
      `the device should not move money directly.`,
  );
}

export const client = {
  get sdk(): FrameSDK {
    return getClient();
  },
};
