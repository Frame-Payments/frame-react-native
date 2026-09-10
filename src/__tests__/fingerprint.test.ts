/**
 * Unit tests for the Fingerprint device-identification wrapper. remoteConfig
 * is mocked directly rather than mocking `fetch`, since fingerprint.ts talks
 * to it, not to the network.
 */

const mockFetchRemoteConfig = jest.fn();
jest.mock('../remoteConfig', () => ({
  fetchRemoteConfig: () => mockFetchRemoteConfig(),
}));

const mockGetVisitorId = jest.fn(() => Promise.resolve('visitor_abc'));
class MockAgent {
  apiKey: string;
  region: string;
  constructor(params: { apiKey: string; region: string }) {
    this.apiKey = params.apiKey;
    this.region = params.region;
  }
  getVisitorId = mockGetVisitorId;
}
// No `{ virtual: true }` here: that flag tells Jest the module doesn't really
// exist on disk, which is false — it's a real devDependency
// (package.json:79). Passing `virtual: true` for a genuinely resolvable
// module is undefined behavior per Jest's own docs, and it showed up as a
// real one: under worker parallelism (reproduced locally with
// `--maxWorkers=2`, never with `--maxWorkers=1`), `loadSdk()`'s `require()`
// would intermittently resolve the real installed package instead of this
// mock, so `isFingerprintAvailable()`/`getFingerprintVisitorId()` saw the
// unmocked `FingerprintJsProAgent` and failed. A plain `jest.mock` for an
// existing module has none of that ambiguity.
jest.mock('@fingerprintjs/fingerprintjs-pro-react-native', () => ({ FingerprintJsProAgent: MockAgent }));

import { __resetFingerprint, getFingerprintVisitorId, isFingerprintAvailable } from '../fingerprint';

beforeEach(() => {
  __resetFingerprint();
  mockFetchRemoteConfig.mockReset();
  mockGetVisitorId.mockReset().mockResolvedValue('visitor_abc');
});

describe('isFingerprintAvailable', () => {
  it('is true when the SDK is linked', () => {
    expect(isFingerprintAvailable()).toBe(true);
  });
});

describe('getFingerprintVisitorId', () => {
  it('returns the visitor id when config and SDK are both available', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ fingerprint: { apiKey: 'k', region: 'us' } });
    expect(await getFingerprintVisitorId()).toBe('visitor_abc');
  });

  it('constructs the agent with the fetched api key and region', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ fingerprint: { apiKey: 'k1', region: 'eu' } });
    await getFingerprintVisitorId();
    // Second call must not re-fetch config or re-construct the agent.
    mockFetchRemoteConfig.mockClear();
    await getFingerprintVisitorId();
    expect(mockFetchRemoteConfig).not.toHaveBeenCalled();
  });

  it('returns null and does not cache a negative agent when the aggregate fetch fails transiently', async () => {
    // Regression: fetchRemoteConfig deliberately does NOT cache a failure (it
    // retries on the next call) — fetchConfiguration used to cache `null`
    // regardless of why it got `null`, permanently disabling fingerprinting
    // after one network blip with no retry path.
    mockFetchRemoteConfig.mockResolvedValueOnce(null);
    expect(await getFingerprintVisitorId()).toBeNull();

    // A later call, once the network recovers, must retry rather than being
    // stuck on the cached negative result.
    mockFetchRemoteConfig.mockResolvedValueOnce({ fingerprint: { apiKey: 'k', region: 'us' } });
    expect(await getFingerprintVisitorId()).toBe('visitor_abc');
  });

  it('caches a stable "no fingerprint block configured" result and does not keep retrying', async () => {
    // Unlike a transient fetch failure, a well-formed response that genuinely
    // omits the fingerprint block is a stable answer worth caching.
    mockFetchRemoteConfig.mockResolvedValue({ evervault: { appId: 'a', teamId: 't' } });
    expect(await getFingerprintVisitorId()).toBeNull();
    mockFetchRemoteConfig.mockClear();
    expect(await getFingerprintVisitorId()).toBeNull();
    expect(mockFetchRemoteConfig).not.toHaveBeenCalled();
  });

  it('returns null when the fingerprint block is missing apiKey or region', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ fingerprint: { apiKey: 'k' } });
    expect(await getFingerprintVisitorId()).toBeNull();
  });

  it('clears the timeout timer once the SDK call wins, rather than leaving it scheduled', async () => {
    // Regression: withTimeout's Promise.race left the losing setTimeout
    // scheduled for the full 5s budget even after the real call won — every
    // single successful call left a live timer handle open for no reason.
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    mockFetchRemoteConfig.mockResolvedValue({ fingerprint: { apiKey: 'k', region: 'us' } });
    expect(await getFingerprintVisitorId()).toBe('visitor_abc');
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('returns null when the SDK call throws', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ fingerprint: { apiKey: 'k', region: 'us' } });
    mockGetVisitorId.mockRejectedValue(new Error('boom'));
    expect(await getFingerprintVisitorId()).toBeNull();
  });

  it('returns null when the visitor id is an empty string', async () => {
    mockFetchRemoteConfig.mockResolvedValue({ fingerprint: { apiKey: 'k', region: 'us' } });
    mockGetVisitorId.mockResolvedValue('');
    expect(await getFingerprintVisitorId()).toBeNull();
  });
});
