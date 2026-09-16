import { fetchRemoteConfig } from './remoteConfig';
import { frameRequestHeaders } from './bespokeRequest';
import { FRAME_API_BASE_URL } from './client';
import { subregionsForCountry } from './addressSubregions';
import { recordEvent } from './accountEvents';
import { AccountEventName, AccountEventScreen, AccountEventDetail } from './accountEventCatalog';
import type { BillingAddress } from './types';

const MAPBOX_SEARCH_BASE = 'https://api.mapbox.com/search/searchbox/v1';

export interface AddressSuggestion {
  id: string;
  title: string;
  subtitle: string;
}

let cachedToken: string | undefined;
let cachedExpiresAt: string | undefined;

function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  const parsed = Date.parse(expiresAt);
  return Number.isFinite(parsed) && parsed <= Date.now();
}

async function fetchMapboxConfig(): Promise<{ accessToken?: string; expiresAt?: string } | null> {
  try {
    const response = await fetch(`${FRAME_API_BASE_URL}/v1/config/mapbox`, {
      method: 'GET',
      headers: frameRequestHeaders(),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { access_token?: unknown; expires_at?: unknown };
    return {
      accessToken: typeof body.access_token === 'string' ? body.access_token : undefined,
      expiresAt: typeof body.expires_at === 'string' ? body.expires_at : undefined,
    };
  } catch {
    return null;
  }
}

async function getToken(): Promise<string | null> {
  if (cachedToken && !isExpired(cachedExpiresAt)) return cachedToken;

  const block = cachedExpiresAt
    ? await fetchMapboxConfig()
    : (await fetchRemoteConfig())?.mapbox;
  if (!block?.accessToken) return null;
  cachedToken = block.accessToken;
  cachedExpiresAt = block.expiresAt;
  return cachedToken;
}

let sessionToken = cryptoRandomUUID();

function cryptoRandomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface MapboxSuggestResponse {
  suggestions?: ReadonlyArray<{
    mapbox_id?: unknown;
    name?: unknown;
    place_formatted?: unknown;
  }>;
}

interface MapboxRetrieveResponse {
  features?: ReadonlyArray<{
    properties?: {
      name?: unknown;
      address?: unknown;
      context?: {
        place?: MapboxContextComponent;
        region?: MapboxContextComponent;
        postcode?: MapboxContextComponent;
        country?: MapboxContextComponent;
      };
    };
  }>;
}

interface MapboxContextComponent {
  name?: unknown;
  region_code?: unknown;
  country_code?: unknown;
}

export async function suggestAddresses(
  query: string,
  countryCode: string | undefined,
  limit: number,
): Promise<AddressSuggestion[]> {
  const token = await getToken();
  if (!token) return [];

  const params = new URLSearchParams({
    q: query,
    session_token: sessionToken,
    types: 'address',
    limit: String(limit),
    access_token: token,
  });
  if (countryCode) params.set('country', countryCode.toLowerCase());

  try {
    const response = await fetch(`${MAPBOX_SEARCH_BASE}/suggest?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        cachedToken = undefined;
        cachedExpiresAt = undefined;
      }
      recordEvent(AccountEventName.ADDRESS_SEARCH_FAILED, AccountEventScreen.ADDRESS_SEARCH, `HTTP ${response.status}`);
      return [];
    }
    const body = (await response.json()) as MapboxSuggestResponse;
    const results = (body.suggestions ?? [])
      .map((s): AddressSuggestion | null => {
        if (typeof s.mapbox_id !== 'string' || typeof s.name !== 'string') return null;
        return {
          id: s.mapbox_id,
          title: s.name,
          subtitle: typeof s.place_formatted === 'string' ? s.place_formatted : '',
        };
      })
      .filter((s): s is AddressSuggestion => s !== null);
    recordEvent(AccountEventName.ADDRESS_SEARCHED, AccountEventScreen.ADDRESS_SEARCH);
    return results;
  } catch (err) {
    recordEvent(AccountEventName.ADDRESS_SEARCH_FAILED, AccountEventScreen.ADDRESS_SEARCH, err instanceof Error ? err.message : undefined);
    return [];
  }
}

export async function retrieveAddress(suggestion: AddressSuggestion): Promise<BillingAddress | null> {
  const token = await getToken();
  if (!token) return null;

  const params = new URLSearchParams({ session_token: sessionToken, access_token: token });

  try {
    const response = await fetch(
      `${MAPBOX_SEARCH_BASE}/retrieve/${encodeURIComponent(suggestion.id)}?${params.toString()}`,
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        cachedToken = undefined;
        cachedExpiresAt = undefined;
      }
      recordEvent(AccountEventName.ADDRESS_LOOKUP_FAILED, AccountEventScreen.ADDRESS_SEARCH, `HTTP ${response.status}`);
      return null;
    }
    const body = (await response.json()) as MapboxRetrieveResponse;
    const feature = body.features?.[0];
    if (!feature) {
      recordEvent(AccountEventName.ADDRESS_LOOKUP_FAILED, AccountEventScreen.ADDRESS_SEARCH, AccountEventDetail.ADDRESS_LOOKUP_NO_FEATURE_RETURNED);
      return null;
    }

    sessionToken = cryptoRandomUUID();
    recordEvent(AccountEventName.ADDRESS_SUGGESTION_SELECTED, AccountEventScreen.ADDRESS_SEARCH);
    return billingAddressFromFeature(feature);
  } catch (err) {
    recordEvent(AccountEventName.ADDRESS_LOOKUP_FAILED, AccountEventScreen.ADDRESS_SEARCH, err instanceof Error ? err.message : undefined);
    return null;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function billingAddressFromFeature(
  feature: NonNullable<MapboxRetrieveResponse['features']>[number],
): BillingAddress {
  const properties = feature.properties;
  const context = properties?.context;
  const countryCode = str(context?.country?.country_code)?.toUpperCase();

  return {
    city: str(context?.place?.name),
    country: countryCode,
    state: subregionFromComponent(context?.region, countryCode),
    postalCode: str(context?.postcode?.name) ?? '',
    addressLine1: str(properties?.address) ?? str(properties?.name),
  };
}

function subregionFromComponent(
  region: MapboxContextComponent | undefined,
  countryCode: string | undefined,
): string | undefined {
  if (!region) return undefined;

  const regionCode = str(region.region_code);
  if (regionCode) {
    const code = regionCode.split('-').pop();
    if (code) return code.toUpperCase();
  }

  const name = str(region.name);
  if (!name) return undefined;
  if (!countryCode) return name;

  const subregions = subregionsForCountry(countryCode);
  if (!subregions) return name;

  const match = subregions.find((s) => s.name.toLowerCase() === name.toLowerCase());
  return match?.code ?? name;
}

export function __resetAddressSearch(): void {
  cachedToken = undefined;
  cachedExpiresAt = undefined;
  sessionToken = cryptoRandomUUID();
}
