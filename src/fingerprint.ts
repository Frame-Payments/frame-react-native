import { frameRequestHeaders } from './bespokeRequest';
import { FRAME_API_BASE_URL } from './client';

// Fingerprint device identification, used to identify the device on a Sonar
// charge session. Mirrors iOS FingerprintManager
// (`Sources/Frame/Networking/FingerprintManager.swift`).
//
// Two deliberate differences from iOS:
//
//   • iOS sends a `Fingerprint-Capability: sealed` header on the config request
//     and prefers a sealed `/v4/events` payload over the raw visitor id. The RN
//     package (@fingerprintjs/fingerprintjs-pro-react-native) exposes only
//     getVisitorId with no sealed-result API, so RN stays on the legacy path by
//     NOT sending that header — the API answers an unstated capability with the
//     legacy key, which is exactly what this client can use.
//   • The framepayments SDK has no getFingerprintConfiguration, so the config
//     is fetched with the shared bespoke-request helper. iOS additionally
//     caches it in the keychain; RN caches in memory for the process, since a
//     missed cache costs one request on the next cold start rather than a
//     failure.

/** A payment must not be held up indefinitely by the fingerprinting SDK. */
const IDENTIFY_TIMEOUT_MS = 5_000;

interface FingerprintConfiguration {
  apiKey: string;
  region: string;
}

interface FingerprintAgent {
  getVisitorId(): Promise<string>;
}

type AgentConstructor = new (params: { apiKey: string; region: string }) => FingerprintAgent;

let cachedSdk: AgentConstructor | null | undefined;
let cachedConfig: FingerprintConfiguration | null | undefined;
let cachedAgent: FingerprintAgent | null | undefined;

function loadSdk(): AgentConstructor | null {
  if (cachedSdk !== undefined) return cachedSdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@fingerprintjs/fingerprintjs-pro-react-native') as {
      FingerprintJsProAgent?: AgentConstructor;
    };
    cachedSdk = mod.FingerprintJsProAgent ?? null;
  } catch {
    cachedSdk = null;
  }
  return cachedSdk;
}

/** True when the Fingerprint SDK is linked in the host app. */
export function isFingerprintAvailable(): boolean {
  return loadSdk() !== null;
}

async function fetchConfiguration(): Promise<FingerprintConfiguration | null> {
  if (cachedConfig !== undefined) return cachedConfig;
  try {
    const response = await fetch(`${FRAME_API_BASE_URL}/v1/config/fingerprint`, {
      method: 'GET',
      headers: frameRequestHeaders(),
    });
    if (!response.ok) {
      cachedConfig = null;
      return null;
    }
    const body = (await response.json()) as { api_key?: unknown; region?: unknown };
    const apiKey = typeof body.api_key === 'string' ? body.api_key : '';
    const region = typeof body.region === 'string' ? body.region : '';
    cachedConfig = apiKey && region ? { apiKey, region } : null;
  } catch {
    cachedConfig = null;
  }
  return cachedConfig;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Returns a Fingerprint visitor id for this device, or null when the SDK isn't
 * linked, the config is unavailable, or identification takes longer than the
 * 5s budget. Callers treat null as "no session can be created" rather than
 * blocking the payment.
 */
export async function getFingerprintVisitorId(): Promise<string | null> {
  const Agent = loadSdk();
  if (!Agent) return null;

  if (cachedAgent === undefined) {
    const config = await fetchConfiguration();
    cachedAgent = config ? new Agent({ apiKey: config.apiKey, region: config.region }) : null;
  }
  if (!cachedAgent) return null;

  try {
    const visitorId = await withTimeout(cachedAgent.getVisitorId(), IDENTIFY_TIMEOUT_MS);
    return typeof visitorId === 'string' && visitorId.length > 0 ? visitorId : null;
  } catch {
    return null;
  }
}

/** Test hook — clears the memoized SDK, config and agent. */
export function __resetFingerprint(): void {
  cachedSdk = undefined;
  cachedConfig = undefined;
  cachedAgent = undefined;
}
