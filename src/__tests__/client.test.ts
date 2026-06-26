const mockPlatform = { OS: 'ios' as 'ios' | 'android' };

jest.mock('react-native', () => ({
  Platform: mockPlatform,
}));

const frameSdkConstructorCalls: Array<{
  apiKey: string | undefined;
  publishableKey: string | undefined;
  defaultHeaders: Record<string, string> | undefined;
}> = [];

class MockFrameSDK {
  apiKey: string | undefined;
  publishableKey: string | undefined;
  defaultHeaders: Record<string, string> | undefined;
  constructor(config: { apiKey?: string; publishableKey?: string; defaultHeaders?: Record<string, string> }) {
    this.apiKey = config.apiKey;
    this.publishableKey = config.publishableKey;
    this.defaultHeaders = config.defaultHeaders;
    frameSdkConstructorCalls.push({
      apiKey: config.apiKey,
      publishableKey: config.publishableKey,
      defaultHeaders: config.defaultHeaders,
    });
  }
}

jest.mock('framepayments', () => ({
  FrameSDK: MockFrameSDK,
}));

import { setConfig, resetConfig, __internal } from '../config';
import { client, warmClients, resetClients, requireSecretKeyFor } from '../client';
import { ErrorCodes } from '../errors';

beforeEach(() => {
  frameSdkConstructorCalls.length = 0;
  resetConfig();
  resetClients();
});

describe('client.sdk', () => {
  it('returns a FrameSDK constructed with both keys when both are configured', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    const inst = client.sdk as unknown as MockFrameSDK;
    expect(inst.apiKey).toBe('sk_test');
    expect(inst.publishableKey).toBe('pk_test');
    expect(frameSdkConstructorCalls).toEqual([
      { apiKey: 'sk_test', publishableKey: 'pk_test', defaultHeaders: { 'User-Agent': 'iOS' } },
    ]);
  });

  it('constructs with only apiKey when publishable key is unset', () => {
    setConfig({ secretKey: 'sk_only', debugMode: false });
    const inst = client.sdk as unknown as MockFrameSDK;
    expect(inst.apiKey).toBe('sk_only');
    expect(inst.publishableKey).toBeUndefined();
  });

  it('constructs with only publishableKey when secret key is unset (mobile shape)', () => {
    setConfig({ publishableKey: 'pk_only', debugMode: false });
    const inst = client.sdk as unknown as MockFrameSDK;
    expect(inst.apiKey).toBeUndefined();
    expect(inst.publishableKey).toBe('pk_only');
  });

  it('throws NOT_INITIALIZED when neither key is configured', () => {
    expect(() => client.sdk).toThrow(
      expect.objectContaining({ code: ErrorCodes.NOT_INITIALIZED }),
    );
  });

  it('memoizes — accessing twice constructs once', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    const a = client.sdk;
    const b = client.sdk;
    expect(a).toBe(b);
    expect(frameSdkConstructorCalls).toHaveLength(1);
  });
});

describe('warmClients', () => {
  it('constructs the client when at least one key is set', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    expect(warmClients()).toBe(true);
    expect(frameSdkConstructorCalls).toHaveLength(1);
  });

  it('skips construction when only one key is set but still returns true', () => {
    setConfig({ secretKey: 'sk_only', debugMode: false });
    expect(warmClients()).toBe(true);
    expect(frameSdkConstructorCalls).toEqual([
      { apiKey: 'sk_only', publishableKey: undefined, defaultHeaders: { 'User-Agent': 'iOS' } },
    ]);
  });

  it('returns false when neither key is set', () => {
    expect(warmClients()).toBe(false);
    expect(frameSdkConstructorCalls).toHaveLength(0);
  });
});

describe('defaultHeaders', () => {
  it('always sends User-Agent so the backend takes the native-SDK code path', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    void client.sdk;
    // Jest's react-native mock defaults Platform.OS to 'ios'.
    expect(frameSdkConstructorCalls[0].defaultHeaders).toEqual({ 'User-Agent': 'iOS' });
  });

  it('adds ip_address alongside User-Agent when the IP is cached', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    __internal.setIpAddress('203.0.113.42');
    void client.sdk;
    expect(frameSdkConstructorCalls[0].defaultHeaders).toEqual({
      ip_address: '203.0.113.42',
      'User-Agent': 'iOS',
    });
  });

  it('picks up a late-arriving IP after resetClients()', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    void client.sdk;
    expect(frameSdkConstructorCalls[0].defaultHeaders).toEqual({ 'User-Agent': 'iOS' });

    __internal.setIpAddress('198.51.100.7');
    resetClients();
    void client.sdk;
    expect(frameSdkConstructorCalls[1].defaultHeaders).toEqual({
      ip_address: '198.51.100.7',
      'User-Agent': 'iOS',
    });
  });

  it('sends versioned Android User-Agent so WalletController#mobile_sdk_request? matches', () => {
    mockPlatform.OS = 'android';
    try {
      setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
      void client.sdk;
      // Must include the slash + version — backend checks `start_with?("Android/")`.
      // Mirrors native Android SDK FrameNetworking.kt header value.
      const ua = frameSdkConstructorCalls[0].defaultHeaders?.['User-Agent'];
      expect(ua).toMatch(/^Android\/\d+\.\d+\.\d+/);
    } finally {
      mockPlatform.OS = 'ios';
    }
  });
});

describe('resetClients', () => {
  it('clears the cache so subsequent access re-constructs', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    void client.sdk;
    expect(frameSdkConstructorCalls).toHaveLength(1);

    resetClients();
    void client.sdk;
    expect(frameSdkConstructorCalls).toHaveLength(2);
  });

  it('lets a re-initialization pick up rotated keys', () => {
    setConfig({ secretKey: 'sk_1', publishableKey: 'pk_1', debugMode: false });
    expect((client.sdk as unknown as MockFrameSDK).apiKey).toBe('sk_1');

    resetClients();
    setConfig({ secretKey: 'sk_2', publishableKey: 'pk_2', debugMode: false });
    expect((client.sdk as unknown as MockFrameSDK).apiKey).toBe('sk_2');
  });
});

describe('requireSecretKeyFor', () => {
  it('throws MISSING_SECRET_KEY with remediation when only a publishable key is configured', () => {
    setConfig({ publishableKey: 'pk_only', debugMode: false });
    try {
      requireSecretKeyFor('Checkout');
      throw new Error('expected requireSecretKeyFor to throw');
    } catch (e: any) {
      expect(e.code).toBe(ErrorCodes.MISSING_SECRET_KEY);
      expect(e.message).toContain('Checkout');
      expect(e.message).toContain('backend');
    }
  });

  it('does not throw when a secret key is configured', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    expect(() => requireSecretKeyFor('Checkout')).not.toThrow();
  });
});
