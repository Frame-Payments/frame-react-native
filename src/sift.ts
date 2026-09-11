import { getSiftConfiguration } from './config';

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
    cachedBridge = mod.isBridgeAvailable?.() === false ? null : (mod.default ?? null);
  } catch {
    cachedBridge = null;
  }
  return cachedBridge;
}

export function isSiftAvailable(): boolean {
  return loadBridge() !== null;
}

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

export function setSiftUserId(userId: string): void {
  if (!configured) return;
  try {
    loadBridge()?.setUserId(userId);
  } catch {
    return;
  }
}

export function unsetSiftUserId(): void {
  if (!configured) return;
  try {
    loadBridge()?.unsetUserId();
  } catch {
    return;
  }
}

export function __resetSift(): void {
  cachedBridge = undefined;
  configured = false;
}
