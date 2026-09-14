jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mockGetAllConfiguration = jest.fn();
jest.mock('framepayments', () => {
  class MockFrameSDK {
    configuration = { getAllConfiguration: () => mockGetAllConfiguration() };
    constructor(_config: unknown) {}
  }
  return { FrameSDK: MockFrameSDK };
});

import { setConfig, resetConfig } from '../config';
import { resetClients } from '../client';
import { __resetRemoteConfig, fetchRemoteConfig, peekRemoteConfig } from '../remoteConfig';

function mockOnce(body: unknown) {
  mockGetAllConfiguration.mockImplementationOnce(async () => body);
}

function mockRejectOnce(err: unknown) {
  mockGetAllConfiguration.mockImplementationOnce(async () => {
    throw err;
  });
}

beforeEach(() => {
  __resetRemoteConfig();
  resetConfig();
  resetClients();
  setConfig({ publishableKey: 'pk_test_x', debugMode: false });
  mockGetAllConfiguration.mockClear();
});

describe('fetchRemoteConfig', () => {
  it('parses every block from the aggregate response', async () => {
    mockOnce({
      evervault: { team_id: 't1', app_id: 'a1' },
      fingerprint: { api_key: 'fp_key', region: 'us' },
      sift: { account_id: 's1', beacon_key: 'b1' },
      legal: {
        privacy_url: 'https://x.test/p',
        terms_url: 'https://x.test/t',
        platform_agreement_url: 'https://x.test/pa',
        cbc_terms_and_conditions: 'https://x.test/cbc',
      },
      mapbox: { access_token: 'pk.mb', expires_at: '2099-01-01T00:00:00Z' },
    });

    const config = await fetchRemoteConfig();
    expect(config).toEqual({
      evervault: { appId: 'a1', teamId: 't1' },
      fingerprint: { apiKey: 'fp_key', region: 'us' },
      sift: { accountId: 's1', beaconKey: 'b1' },
      legal: {
        privacyUrl: 'https://x.test/p',
        termsUrl: 'https://x.test/t',
        platformAgreementUrl: 'https://x.test/pa',
        cbcTermsUrl: 'https://x.test/cbc',
      },
      mapbox: { accessToken: 'pk.mb', expiresAt: '2099-01-01T00:00:00Z' },
    });
  });

  it('omits a block entirely when the response doesn\'t carry it', async () => {
    mockOnce({ evervault: { team_id: 't1', app_id: 'a1' } });
    const config = await fetchRemoteConfig();
    expect(config?.evervault).toEqual({ appId: 'a1', teamId: 't1' });
    expect(config?.mapbox).toBeUndefined();
  });

  it('caches the result — a second call makes no second request', async () => {
    mockOnce({ evervault: { team_id: 't1', app_id: 'a1' } });
    await fetchRemoteConfig();
    await fetchRemoteConfig();
    expect(mockGetAllConfiguration).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent callers onto one in-flight request', async () => {
    let resolveResponse!: (v: unknown) => void;
    mockGetAllConfiguration.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const p1 = fetchRemoteConfig();
    const p2 = fetchRemoteConfig();
    resolveResponse({ evervault: { team_id: 't', app_id: 'a' } });
    const [c1, c2] = await Promise.all([p1, p2]);
    expect(c1).toEqual(c2);
    expect(mockGetAllConfiguration).toHaveBeenCalledTimes(1);
  });

  it('resolves null on a failed request, without throwing', async () => {
    mockRejectOnce(new Error('HTTP 503'));
    await expect(fetchRemoteConfig()).resolves.toBeNull();
  });

  it('resolves null when the request throws', async () => {
    mockRejectOnce(new Error('offline'));
    await expect(fetchRemoteConfig()).resolves.toBeNull();
  });

  it('does not cache a failure — a later call can succeed', async () => {
    mockRejectOnce(new Error('HTTP 503'));
    expect(await fetchRemoteConfig()).toBeNull();
    mockOnce({ evervault: { team_id: 't1', app_id: 'a1' } });
    expect(await fetchRemoteConfig()).toEqual({ evervault: { appId: 'a1', teamId: 't1' } });
  });

  it('ignores empty-string fields', async () => {
    mockOnce({ evervault: { team_id: '', app_id: 'a1' } });
    const config = await fetchRemoteConfig();
    expect(config?.evervault?.teamId).toBeUndefined();
    expect(config?.evervault?.appId).toBe('a1');
  });
});

describe('peekRemoteConfig', () => {
  it('is null before any fetch', () => {
    expect(peekRemoteConfig()).toBeNull();
  });

  it('reflects the cached value after a fetch', async () => {
    mockOnce({ evervault: { team_id: 't1', app_id: 'a1' } });
    await fetchRemoteConfig();
    expect(peekRemoteConfig()).toEqual({ evervault: { appId: 'a1', teamId: 't1' } });
  });
});
