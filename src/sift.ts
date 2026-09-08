import { getSiftConfiguration } from './config';

// Sift device-intelligence initialization. Mirrors iOS SiftManager.initializeSift
// (`Sources/Frame/Networking/SiftManager.swift:32-47`), which sets the account id
// and beacon key on the shared Sift instance at SDK start-up.
//
// Frame.initialize already fetches and caches the Sift config; until now nothing
// ever handed it to the SDK, so no device events were collected on RN at all.
//
// sift-react-native is a HARD peer dep, but its bridge is still guarded: an app
// that hasn't rebuilt after adding the package has the JS module resolving while
// the native side is missing, and a throw here would fail Frame.initialize.

// The Sift SDK's own default endpoint. The RN bridge requires the parameter
// (unlike the iOS SDK, which defaults it internally), so it is stated here.
const SIFT_SERVER_URL_FORMAT = 'https://api3.siftscience.com/v3/accounts/%s/mobile_events';

interface SiftBridge {
  setSiftConfig(
    accountId: string,
    beaconKey: string,
    disallowCollectingLocationData: boolean,
    serverUrlFormat: string,
  ): void;
  setUserId(userId: string): void;
  unsetUserId(): void;
  upload(): void;
}

let cachedBridge: SiftBridge | null | undefined;
let configured = false;

function loadBridge(): SiftBridge | null {
  if (cachedBridge !== undefined) return cachedBridge;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('sift-react-native') as {
      default?: SiftBridge;
      isBridgeAvailable?: () => boolean;
    };
    // The package exports isBridgeAvailable precisely because the JS module can
    // resolve while the native module is absent.
    cachedBridge = mod.isBridgeAvailable?.() === false ? null : (mod.default ?? null);
  } catch {
    cachedBridge = null;
  }
  return cachedBridge;
}

/** True when the Sift native bridge is linked in the host app. */
export function isSiftAvailable(): boolean {
  return loadBridge() !== null;
}

/**
 * Hands the cached Sift configuration to the SDK so it starts collecting device
 * events. Idempotent, and a no-op when the config hasn't landed yet — the
 * prefetch is in flight at this point, so the caller retries after it resolves.
 *
 * Location collection is disallowed: Frame's own geo-compliance step asks for
 * location explicitly with its own prompt, and letting Sift trigger a second,
 * unexplained permission dialog at start-up is not something the SDK should do
 * on a host app's behalf.
 *
 * @returns true when the SDK was configured.
 */
export function initializeSift(): boolean {
  if (configured) return true;
  const bridge = loadBridge();
  if (!bridge) return false;
  const config = getSiftConfiguration();
  if (!config?.accountId || !config?.beaconKey) return false;
  try {
    bridge.setSiftConfig(config.accountId, config.beaconKey, true, SIFT_SERVER_URL_FORMAT);
    configured = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Associates the current Sift session with a customer, so events collected on
 * this device are attributed to them. Mirrors iOS SiftManager's `$login` path.
 * Safe to call before initializeSift succeeds — it no-ops.
 */
export function setSiftUserId(userId: string): void {
  if (!configured) return;
  try {
    loadBridge()?.setUserId(userId);
  } catch {
    // Device intelligence is opportunistic; never fail a flow over it.
  }
}

/** Clears the association set by {@link setSiftUserId} (e.g. on sign-out). */
export function unsetSiftUserId(): void {
  if (!configured) return;
  try {
    loadBridge()?.unsetUserId();
  } catch {
    // See setSiftUserId.
  }
}

/** Test hook — clears the memoized bridge and the configured latch. */
export function __resetSift(): void {
  cachedBridge = undefined;
  configured = false;
}
