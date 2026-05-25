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
import { client, warmClients, resetClients } from '../client';
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
    expect(frameSdkConstructorCalls).toEqual([{ apiKey: 'sk_test', publishableKey: 'pk_test' }]);
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
    expect(frameSdkConstructorCalls).toEqual([{ apiKey: 'sk_only', publishableKey: undefined }]);
  });

  it('returns false when neither key is set', () => {
    expect(warmClients()).toBe(false);
    expect(frameSdkConstructorCalls).toHaveLength(0);
  });
});

describe('ip_address header injection', () => {
  it('omits defaultHeaders when no IP has been resolved', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    void client.sdk;
    expect(frameSdkConstructorCalls[0].defaultHeaders).toBeUndefined();
  });

  it('passes ip_address in defaultHeaders when the IP is cached', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    __internal.setIpAddress('203.0.113.42');
    void client.sdk;
    expect(frameSdkConstructorCalls[0].defaultHeaders).toEqual({ ip_address: '203.0.113.42' });
  });

  it('picks up a late-arriving IP after resetClients()', () => {
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    void client.sdk;
    expect(frameSdkConstructorCalls[0].defaultHeaders).toBeUndefined();

    __internal.setIpAddress('198.51.100.7');
    resetClients();
    void client.sdk;
    expect(frameSdkConstructorCalls[1].defaultHeaders).toEqual({ ip_address: '198.51.100.7' });
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
