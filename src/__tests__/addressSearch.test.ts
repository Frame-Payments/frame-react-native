/**
 * Unit tests for the Mapbox address-search client. remoteConfig is mocked
 * directly (addressSearch.ts talks to it for the token, not to the network
 * for config), and `fetch` is stubbed for the Mapbox calls themselves.
 */

const mockFetchRemoteConfig = jest.fn();
jest.mock('../remoteConfig', () => ({
  fetchRemoteConfig: () => mockFetchRemoteConfig(),
}));

import {
  __resetAddressSearch,
  retrieveAddress,
  suggestAddresses,
  type AddressSuggestion,
} from '../addressSearch';

function mockFetchOnce(body: unknown, ok = true, status = ok ? 200 : 500) {
  (global.fetch as jest.Mock).mockImplementationOnce(async () => ({
    ok,
    status,
    json: async () => body,
  }));
}

beforeEach(() => {
  __resetAddressSearch();
  mockFetchRemoteConfig.mockReset();
  global.fetch = jest.fn();
});

describe('suggestAddresses', () => {
  it('returns [] when no Mapbox token is configured', async () => {
    mockFetchRemoteConfig.mockResolvedValue({});
    const result = await suggestAddresses('123 Main', 'US', 3);
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches suggestions with the token, query, country, and limit', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({
      suggestions: [{ mapbox_id: 'abc', name: '123 Main St', place_formatted: 'Austin, TX' }],
    });

    const result = await suggestAddresses('123 Main', 'US', 3);
    expect(result).toEqual([{ id: 'abc', title: '123 Main St', subtitle: 'Austin, TX' }]);

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://api.mapbox.com/search/searchbox/v1/suggest');
    expect(parsed.searchParams.get('q')).toBe('123 Main');
    expect(parsed.searchParams.get('country')).toBe('us');
    expect(parsed.searchParams.get('limit')).toBe('3');
    expect(parsed.searchParams.get('access_token')).toBe('pk.test');
    expect(parsed.searchParams.get('types')).toBe('address');
  });

  it('omits the country param when none is given', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({ suggestions: [] });
    await suggestAddresses('123 Main', undefined, 3);
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(new URL(url).searchParams.has('country')).toBe(false);
  });

  it('caches the token across calls — one config fetch for two searches', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({ suggestions: [] });
    mockFetchOnce({ suggestions: [] });
    await suggestAddresses('a', 'US', 3);
    await suggestAddresses('b', 'US', 3);
    expect(mockFetchRemoteConfig).toHaveBeenCalledTimes(1);
  });

  it('re-fetches the token once it has expired', async () => {
    mockFetchRemoteConfig
      .mockResolvedValueOnce({
        mapbox: { accessToken: 'pk.old', expiresAt: new Date(Date.now() - 1000).toISOString() },
      })
      .mockResolvedValueOnce({ mapbox: { accessToken: 'pk.new' } });
    mockFetchOnce({ suggestions: [] });
    mockFetchOnce({ suggestions: [] });

    await suggestAddresses('a', 'US', 3);
    await suggestAddresses('b', 'US', 3);

    expect(mockFetchRemoteConfig).toHaveBeenCalledTimes(2);
    const secondUrl = (global.fetch as jest.Mock).mock.calls[1]![0] as string;
    expect(new URL(secondUrl).searchParams.get('access_token')).toBe('pk.new');
  });

  it('drops the cached token on a 401/403 so the next call refetches', async () => {
    mockFetchRemoteConfig
      .mockResolvedValueOnce({ mapbox: { accessToken: 'pk.rejected' } })
      .mockResolvedValueOnce({ mapbox: { accessToken: 'pk.fresh' } });
    mockFetchOnce({}, false, 401);
    mockFetchOnce({ suggestions: [] });

    const first = await suggestAddresses('a', 'US', 3);
    expect(first).toEqual([]);
    await suggestAddresses('b', 'US', 3);

    expect(mockFetchRemoteConfig).toHaveBeenCalledTimes(2);
  });

  it('returns [] rather than throwing when Mapbox is unreachable', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    (global.fetch as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('offline');
    });
    await expect(suggestAddresses('a', 'US', 3)).resolves.toEqual([]);
  });

  it('drops a suggestion missing an id or name rather than crashing', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({
      suggestions: [
        { mapbox_id: 'good', name: 'Good St' },
        { name: 'No id' },
        { mapbox_id: 'no-name' },
      ],
    });
    const result = await suggestAddresses('a', 'US', 3);
    expect(result).toEqual([{ id: 'good', title: 'Good St', subtitle: '' }]);
  });
});

describe('retrieveAddress', () => {
  const suggestion: AddressSuggestion = { id: 'abc', title: 'x', subtitle: 'y' };

  it('returns null when no token is configured', async () => {
    mockFetchRemoteConfig.mockResolvedValue({});
    expect(await retrieveAddress(suggestion)).toBeNull();
  });

  it('maps a US feature to a BillingAddress, uppercasing the region code', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({
      features: [
        {
          properties: {
            name: '123 Main St',
            address: '123 Main St',
            context: {
              place: { name: 'Austin' },
              region: { name: 'Texas', region_code: 'US-TX' },
              postcode: { name: '78701' },
              country: { country_code: 'us' },
            },
          },
        },
      ],
    });

    const result = await retrieveAddress(suggestion);
    expect(result).toEqual({
      city: 'Austin',
      country: 'US',
      state: 'TX',
      postalCode: '78701',
      addressLine1: '123 Main St',
    });
  });

  it('falls back to properties.name when address is absent', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({
      features: [{ properties: { name: 'Fallback Name', context: {} } }],
    });
    const result = await retrieveAddress(suggestion);
    expect(result?.addressLine1).toBe('Fallback Name');
  });

  it('never populates line2 — Mapbox does not reliably return apartment/unit', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({
      features: [{ properties: { address: '1 Main St', context: {} } }],
    });
    const result = await retrieveAddress(suggestion);
    expect(result).not.toHaveProperty('addressLine2');
  });

  it('matches a region NAME (no region_code) against the SDK subregion list', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({
      features: [
        {
          properties: {
            address: '1 Main St',
            context: {
              region: { name: 'California' }, // no region_code
              country: { country_code: 'US' },
            },
          },
        },
      ],
    });
    const result = await retrieveAddress(suggestion);
    expect(result?.state).toBe('CA');
  });

  it('falls back to the raw region name for a free-text country', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({
      features: [
        {
          properties: {
            address: '1 Main St',
            context: {
              region: { name: 'Greater London' },
              country: { country_code: 'GB' },
            },
          },
        },
      ],
    });
    const result = await retrieveAddress(suggestion);
    expect(result?.state).toBe('Greater London');
  });

  it('returns null when the response carries no features', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({ features: [] });
    expect(await retrieveAddress(suggestion)).toBeNull();
  });

  it('returns null rather than throwing on a network failure', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    (global.fetch as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('offline');
    });
    expect(await retrieveAddress(suggestion)).toBeNull();
  });

  it('defaults postalCode to an empty string rather than undefined', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({ features: [{ properties: { address: '1 Main St', context: {} } }] });
    const result = await retrieveAddress(suggestion);
    expect(result?.postalCode).toBe('');
  });

  it('regenerates the session token after a successful retrieve', async () => {
    // Billing-session grouping: the next suggest call after a retrieve must
    // start a fresh session rather than continuing to bill against the one
    // that just ended.
    mockFetchRemoteConfig.mockResolvedValue({ mapbox: { accessToken: 'pk.test' } });
    mockFetchOnce({ features: [{ properties: { address: '1 Main St', context: {} } }] });
    mockFetchOnce({ suggestions: [] });

    await retrieveAddress(suggestion);
    const retrieveUrl = new URL((global.fetch as jest.Mock).mock.calls[0]![0] as string);

    await suggestAddresses('a', 'US', 3);
    const suggestUrl = new URL((global.fetch as jest.Mock).mock.calls[1]![0] as string);

    expect(suggestUrl.searchParams.get('session_token')).not.toBe(
      retrieveUrl.searchParams.get('session_token'),
    );
  });
});
