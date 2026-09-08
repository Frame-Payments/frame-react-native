import { fetchRemoteConfig } from './remoteConfig';
import { subregionsForCountry } from './addressSubregions';
import type { BillingAddress } from './types';

// Looks up addresses through the Mapbox Search Box API. Ports iOS
// AddressSearchService (`Sources/Frame/Networking/AddressSearch/AddressSearchService.swift`),
// AddressSuggestion.swift, and AddressSuggestionMapper.swift.
//
// The access token is served by Frame's configuration API rather than embedded
// in the SDK, so it can be rotated without a release. Requests go straight to
// Mapbox — this is the one hand-rolled call in the SDK that does NOT go through
// bespokeRequest's frameRequestHeaders/FRAME_API_BASE_URL, because those
// deliberately route to Frame's own host and Mapbox needs a different one and a
// different auth scheme (the Mapbox token as a query param, not a bearer
// header).
//
// Autocomplete is an accelerator, not a gate: every failure path (no token,
// Mapbox unreachable, an empty result set) resolves to an empty list rather
// than throwing, so a user typing an address by hand is never blocked or shown
// an error for a convenience feature.

const MAPBOX_SEARCH_BASE = 'https://api.mapbox.com/search/searchbox/v1';

/** One address the user can pick from the autocomplete list. */
export interface AddressSuggestion {
  /** Identifies the suggestion within its search session. */
  id: string;
  /** The first line of the row, typically the street address. */
  title: string;
  /** The second line of the row, typically city, state, and country. */
  subtitle: string;
}

let cachedToken: string | undefined;
let cachedExpiresAt: string | undefined;

function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  const parsed = Date.parse(expiresAt);
  return Number.isFinite(parsed) && parsed <= Date.now();
}

async function getToken(): Promise<string | null> {
  if (cachedToken && !isExpired(cachedExpiresAt)) return cachedToken;
  const config = await fetchRemoteConfig();
  const block = config?.mapbox;
  if (!block?.accessToken) return null;
  cachedToken = block.accessToken;
  cachedExpiresAt = block.expiresAt;
  return cachedToken;
}

/**
 * Groups a sequence of keystrokes with the retrieve that ends it, which is how
 * Mapbox bills a search. A fresh token per session would bill every keystroke
 * as its own lookup. Regenerated after each successful retrieve, matching iOS.
 */
let sessionToken = cryptoRandomUUID();

function cryptoRandomUUID(): string {
  // React Native's JS runtime (Hermes) doesn't ship crypto.randomUUID; this
  // value is a billing-session grouping key, not a security token, so a
  // Math.random-based v4-shaped id is sufficient.
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

/**
 * Returns the addresses matching a partial query, restricted to one country.
 *
 * @param query - What the user has typed so far.
 * @param countryCode - ISO 3166-1 alpha-2 code the results are limited to, so
 *   a checkout locked to one country does not surface addresses from another.
 * @returns Up to `limit` suggestions, or an empty array on any failure — never
 *   throws, since this is an accelerator, not a gate.
 */
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
      // A rejected token is worth dropping: the next call refetches rather
      // than repeating a request that cannot succeed.
      if (response.status === 401 || response.status === 403) {
        cachedToken = undefined;
        cachedExpiresAt = undefined;
      }
      return [];
    }
    const body = (await response.json()) as MapboxSuggestResponse;
    return (body.suggestions ?? [])
      .map((s): AddressSuggestion | null => {
        if (typeof s.mapbox_id !== 'string' || typeof s.name !== 'string') return null;
        return {
          id: s.mapbox_id,
          title: s.name,
          subtitle: typeof s.place_formatted === 'string' ? s.place_formatted : '',
        };
      })
      .filter((s): s is AddressSuggestion => s !== null);
  } catch {
    return [];
  }
}

/**
 * Resolves a suggestion into a full billing address. Ends the billing
 * session: the next {@link suggestAddresses} call starts a new one.
 *
 * @returns The resolved address, or null on any failure.
 */
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
      return null;
    }
    const body = (await response.json()) as MapboxRetrieveResponse;
    const feature = body.features?.[0];
    if (!feature) return null;

    sessionToken = cryptoRandomUUID();
    return billingAddressFromFeature(feature);
  } catch {
    return null;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Builds a billing address from a retrieved Mapbox feature. Ports iOS
 * AddressSuggestionMapper.billingAddress(from:).
 *
 * Address line 2 is never populated: Mapbox does not reliably return
 * apartment or unit, so the field stays as the user left it.
 */
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

/**
 * Resolves the subregion to the form the SDK's validation expects.
 * `validateSubregion` runs against the raw value and matches it against the
 * two-letter codes for countries that enumerate them, so a full name like
 * "California" has to become "CA" here — `normalizeSubregion` runs only at
 * submit time, which is too late to rescue it before the user sees a
 * validation error on a value they never typed.
 *
 * Mapbox's `region_code` is the level's short code — `US-CA` in some
 * responses, `CA` in others — so the country prefix is dropped when present.
 * When Mapbox sends no code at all, the name is matched against the SDK's own
 * subregion list before falling back to the raw value, which keeps free-text
 * countries working as they do today. Ports iOS
 * AddressSuggestionMapper.subregion(from:countryCode:).
 */
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

/** Test hook — clears the cached Mapbox token and resets the billing session. */
export function __resetAddressSearch(): void {
  cachedToken = undefined;
  cachedExpiresAt = undefined;
  sessionToken = cryptoRandomUUID();
}
