import { frameRequestHeaders } from './bespokeRequest';
import { FRAME_API_BASE_URL } from './client';

// One fetch of `/v1/config/all` for every third-party credential the SDK needs.
// Mirrors iOS, which consolidated five separate config calls into this endpoint
// (frame-ios 262ef10, FRA-6251) — the aggregate is the only config request a
// normal launch makes, and its blocks are what every later getter serves.
//
// Without this, RN made three round-trips at start-up (evervault + sift through
// the framepayments SDK, then fingerprint, then legal), each on the critical
// path to a usable checkout.
//
// Cached for the process. iOS additionally persists to the keychain; a missed
// cache here costs one request on the next cold start, and every consumer has a
// fallback or degrades cleanly, so persistence buys little.
//
// The framepayments SDK's ConfigurationAPI only exposes
// getEvervaultConfiguration()/getSiftConfiguration() as typed methods — no
// aggregate, and no fingerprint/legal/mapbox getters at all — so this whole
// module is a hand-rolled fetch. Typed SDK support requested in FRA-6648.

export interface EvervaultConfigBlock {
  appId?: string;
  teamId?: string;
}

export interface FingerprintConfigBlock {
  apiKey?: string;
  region?: string;
}

export interface SiftConfigBlock {
  accountId?: string;
  beaconKey?: string;
}

export interface LegalConfigBlock {
  privacyUrl?: string;
  termsUrl?: string;
  platformAgreementUrl?: string;
  cbcTermsUrl?: string;
}

export interface MapboxConfigBlock {
  accessToken?: string;
  /** ISO-8601, or undefined when the token does not expire. */
  expiresAt?: string;
}

export interface RemoteConfig {
  evervault?: EvervaultConfigBlock;
  fingerprint?: FingerprintConfigBlock;
  sift?: SiftConfigBlock;
  legal?: LegalConfigBlock;
  mapbox?: MapboxConfigBlock;
}

let cached: RemoteConfig | null = null;
let inFlight: Promise<RemoteConfig | null> | null = null;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function block(raw: unknown): Record<string, unknown> | null {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
}

function parse(body: Record<string, unknown>): RemoteConfig {
  const out: RemoteConfig = {};

  const ev = block(body.evervault);
  if (ev) out.evervault = { appId: str(ev.app_id), teamId: str(ev.team_id) };

  const fp = block(body.fingerprint);
  if (fp) out.fingerprint = { apiKey: str(fp.api_key), region: str(fp.region) };

  const sift = block(body.sift);
  if (sift) out.sift = { accountId: str(sift.account_id), beaconKey: str(sift.beacon_key) };

  const legal = block(body.legal);
  if (legal) {
    out.legal = {
      privacyUrl: str(legal.privacy_url),
      termsUrl: str(legal.terms_url),
      platformAgreementUrl: str(legal.platform_agreement_url),
      // iOS decodes this one as `cbcTermsAndConditions`, so the wire name is the
      // un-suffixed form rather than `cbc_terms_url`.
      cbcTermsUrl: str(legal.cbc_terms_and_conditions),
    };
  }

  const mapbox = block(body.mapbox);
  if (mapbox) {
    out.mapbox = { accessToken: str(mapbox.access_token), expiresAt: str(mapbox.expires_at) };
  }

  return out;
}

/**
 * Fetches `/v1/config/all` once and caches it. Concurrent callers share the
 * single in-flight request rather than each issuing their own.
 *
 * Resolves null when the request fails — every consumer either has a bundled
 * fallback (legal) or degrades to "feature unavailable" (fingerprint, mapbox),
 * so a failure here must not throw into `Frame.initialize`.
 */
export async function fetchRemoteConfig(): Promise<RemoteConfig | null> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch(`${FRAME_API_BASE_URL}/v1/config/all`, {
        method: 'GET',
        headers: frameRequestHeaders(),
      });
      if (!response.ok) return null;
      cached = parse((await response.json()) as Record<string, unknown>);
      return cached;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** The cached config, without triggering a fetch. */
export function peekRemoteConfig(): RemoteConfig | null {
  return cached;
}

/** Test hook — clears the cache and any in-flight request. */
export function __resetRemoteConfig(): void {
  cached = null;
  inFlight = null;
}
