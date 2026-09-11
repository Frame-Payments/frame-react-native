
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
    mockFetchRemoteConfig.mockClear();
    await getFingerprintVisitorId();
    expect(mockFetchRemoteConfig).not.toHaveBeenCalled();
  });

  it('returns null and does not cache a negative agent when the aggregate fetch fails transiently', async () => {
    mockFetchRemoteConfig.mockResolvedValueOnce(null);
    expect(await getFingerprintVisitorId()).toBeNull();

    mockFetchRemoteConfig.mockResolvedValueOnce({ fingerprint: { apiKey: 'k', region: 'us' } });
    expect(await getFingerprintVisitorId()).toBe('visitor_abc');
  });

  it('caches a stable "no fingerprint block configured" result and does not keep retrying', async () => {
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
