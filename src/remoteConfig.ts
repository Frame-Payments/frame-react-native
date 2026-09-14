import { client } from './client';

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
      cbcTermsUrl: str(legal.cbc_terms_and_conditions),
    };
  }

  const mapbox = block(body.mapbox);
  if (mapbox) {
    out.mapbox = { accessToken: str(mapbox.access_token), expiresAt: str(mapbox.expires_at) };
  }

  return out;
}

export async function fetchRemoteConfig(): Promise<RemoteConfig | null> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const body = await client.sdk.configuration.getAllConfiguration({ usePublishableKey: true });
      cached = parse(body as unknown as Record<string, unknown>);
      return cached;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function peekRemoteConfig(): RemoteConfig | null {
  return cached;
}

export function __resetRemoteConfig(): void {
  cached = null;
  inFlight = null;
}
