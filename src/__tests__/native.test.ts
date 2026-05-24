/**
 * Unit tests for the native module bridge (initialize, presentCheckout, presentCart,
 * presentApplePay, presentGooglePay, presentOnboarding). NativeModules.FrameSDK is mocked.
 */

const mockInitialize = jest.fn((_secretKey: string, _publishableKey: string, _debugMode: boolean, _applePayMerchantId: string | null, _googlePayMerchantId: string | null, _theme: unknown) => Promise.resolve());
const mockPresentCheckout = jest.fn((_accountId: unknown, _amount: number) => Promise.resolve('tr_1'));
const mockPresentCart = jest.fn((_accountId: unknown, _items: unknown[], _shipping: number) => Promise.resolve('tr_2'));
const mockPresentApplePay = jest.fn((_ownerType: string, _ownerId: string, _amount: number, _currency: string) => Promise.resolve('tr_3'));
const mockPresentGooglePay = jest.fn((_amountCents: number, _ownerType: string, _ownerId: string, _currencyCode: string) => Promise.resolve('tr_4'));
const mockPresentOnboarding = jest.fn((_accountId: unknown, _capabilities: unknown[]) => Promise.resolve({ status: 'completed', accountId: 'acct_1' }));

const mockPlatform = { OS: 'ios' as 'ios' | 'android' };

// native.tsx now transitively imports the Cart/Checkout screens, which pull in
// StyleSheet, Animated, Appearance, etc. Provide enough of the RN surface for
// the modules to load without rendering.
jest.mock('react-native', () => {
  const noop = () => undefined;
  const stylesheetCreate = (s: unknown) => s;
  return {
    NativeModules: {
      FrameSDK: {
        initialize: mockInitialize,
        presentCheckout: mockPresentCheckout,
        presentCart: mockPresentCart,
        presentApplePay: mockPresentApplePay,
        presentGooglePay: mockPresentGooglePay,
        presentOnboarding: mockPresentOnboarding,
      },
      FrameApplePay: {
        canMakeApplePay: () => Promise.resolve(false),
        presentApplePay: () => Promise.resolve({}),
        finishApplePay: () => Promise.resolve(),
      },
      FrameGooglePay: {
        isGooglePayReady: () => Promise.resolve(false),
        presentGooglePay: () => Promise.resolve({}),
      },
      FrameAttestation: {
        isSupported: () => Promise.resolve(false),
        attestedKeyId: () => Promise.resolve(null),
        generateKey: () => Promise.resolve(''),
        attestKey: () => Promise.resolve(''),
        promoteKey: () => Promise.resolve(),
        clearPendingKey: () => Promise.resolve(),
        generateAssertion: () => Promise.resolve(''),
        resetAttestation: () => Promise.resolve(),
      },
    },
    Platform: mockPlatform,
    StyleSheet: { create: stylesheetCreate, hairlineWidth: 1 },
    Animated: {
      Value: class { constructor(_v: number) {} setValue() {} },
      timing: () => ({ start: noop }),
      spring: () => ({ start: noop }),
      parallel: () => ({ start: noop }),
      View: 'Animated.View',
    },
    Appearance: {
      getColorScheme: () => 'light',
      addChangeListener: () => ({ remove: noop }),
    },
    requireNativeComponent: (name: string) => name,
  };
});

// The Evervault RN SDK ships a .tsx entrypoint that transitively imports
// react-native; stub it out so ts-jest doesn't try to compile Flow syntax.
const evervaultInitMock = jest.fn(() => Promise.resolve());
const evervaultEncryptMock = jest.fn((v: unknown) => Promise.resolve(`ev:${String(v)}`));
jest.mock('@evervault/evervault-react-native', () => ({
  init: evervaultInitMock,
  encrypt: evervaultEncryptMock,
}));

// initialize() kicks off a background prefetch via framepayments. Without
// mocking it, axios would open real sockets and hang the suite.
const getEvervaultConfigMock = jest.fn(() => Promise.resolve({ team_id: 'team_x', app_id: 'app_x' }));
const getSiftConfigMock = jest.fn(() => Promise.resolve({ account_id: 'sift_a', beacon_key: 'beacon_b' }));
jest.mock('framepayments', () => {
  class MockFrameSDK {
    configuration = {
      getEvervaultConfiguration: getEvervaultConfigMock,
      getSiftConfiguration: getSiftConfigMock,
    };
    constructor(_config: unknown) {}
  }
  return { FrameSDK: MockFrameSDK };
});

// Re-import after mock so we get the mocked NativeModules
let initialize: (opts: { secretKey: string; publishableKey: string; debugMode?: boolean; applePayMerchantId?: string; googlePayMerchantId?: string }) => Promise<void>;
let presentCheckout: (opts: { accountId: string; amount: number }) => Promise<string>;
let presentCart: (opts: {
  accountId: string;
  items: Array<{ id: string; title: string; amountInCents: number; imageUrl: string }>;
  shippingAmountInCents: number;
}) => Promise<string>;
let presentApplePay: (opts: { amount: number; currency?: string; owner: { type: 'customer' | 'account'; id: string } }) => Promise<string>;
let presentGooglePay: (opts: { amountCents: number; owner: { type: 'customer' | 'account'; id: string }; currencyCode?: string }) => Promise<string>;
let presentOnboarding: (opts: { accountId?: string | null; capabilities?: string[] }) => Promise<unknown>;

beforeEach(() => {
  jest.resetModules();
  mockInitialize.mockClear();
  mockPresentCheckout.mockClear();
  mockPresentCart.mockClear();
  mockPresentApplePay.mockClear();
  mockPresentGooglePay.mockClear();
  mockPresentOnboarding.mockClear();
  evervaultInitMock.mockClear().mockResolvedValue(undefined as never);
  evervaultEncryptMock.mockClear();
  getEvervaultConfigMock.mockClear().mockResolvedValue({ team_id: 'team_x', app_id: 'app_x' });
  getSiftConfigMock.mockClear().mockResolvedValue({ account_id: 'sift_a', beacon_key: 'beacon_b' });
  mockPlatform.OS = 'ios';
  const native = require('../native');
  initialize = native.initialize;
  presentCheckout = native.presentCheckout;
  presentCart = native.presentCart;
  presentApplePay = native.presentApplePay;
  presentGooglePay = native.presentGooglePay;
  presentOnboarding = native.presentOnboarding;
});

describe('initialize', () => {
  it('calls native FrameSDK.initialize with all six positional args', () => {
    initialize({ secretKey: 'sk_test_xxx', publishableKey: 'pk_test_xxx', debugMode: true });
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledWith('sk_test_xxx', 'pk_test_xxx', true, null, null, null);
  });

  it('defaults debugMode to false and both merchant IDs to null', () => {
    initialize({ secretKey: 'sk_test_yyy', publishableKey: 'pk_test_yyy' });
    expect(mockInitialize).toHaveBeenCalledWith('sk_test_yyy', 'pk_test_yyy', false, null, null, null);
  });

  it('forwards applePayMerchantId to native init', () => {
    initialize({
      secretKey: 'sk_test',
      publishableKey: 'pk_test',
      applePayMerchantId: 'merchant.com.example',
    });
    expect(mockInitialize).toHaveBeenCalledWith('sk_test', 'pk_test', false, 'merchant.com.example', null, null);
  });

  it('forwards googlePayMerchantId to native init', () => {
    initialize({
      secretKey: 'sk_test',
      publishableKey: 'pk_test',
      googlePayMerchantId: 'BCR2DN4T...',
    });
    expect(mockInitialize).toHaveBeenCalledWith('sk_test', 'pk_test', false, null, 'BCR2DN4T...', null);
  });

  it('throws if secretKey is missing', () => {
    expect(() => initialize({ secretKey: '', publishableKey: 'pk_test' })).toThrow(/secretKey/);
    expect(() => (initialize as any)({ publishableKey: 'pk_test' })).toThrow(/secretKey/);
    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it('throws if publishableKey is missing', () => {
    expect(() => initialize({ secretKey: 'sk_test', publishableKey: '' })).toThrow(/publishableKey/);
    expect(() => (initialize as any)({ secretKey: 'sk_test' })).toThrow(/publishableKey/);
    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it('throws if theme is not a plain object', () => {
    expect(() =>
      (initialize as any)({ secretKey: 'sk_test', publishableKey: 'pk_test', theme: 'not-an-object' }),
    ).toThrow(/theme must be an object/);
    expect(() =>
      (initialize as any)({ secretKey: 'sk_test', publishableKey: 'pk_test', theme: [] }),
    ).toThrow(/theme must be an object/);
    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it('accepts a plain-object theme and forwards it to native init', async () => {
    const theme = { colors: { primaryButton: '#FF0066' } };
    await initialize({ secretKey: 'sk_test', publishableKey: 'pk_test', theme });
    expect(mockInitialize).toHaveBeenCalledWith('sk_test', 'pk_test', false, null, null, theme);
  });

  it('does not flip isInitialized=true until the native bridge resolves', async () => {
    let resolveNative: (() => void) | undefined;
    mockInitialize.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveNative = resolve; }),
    );

    const initPromise = initialize({ secretKey: 'sk_test', publishableKey: 'pk_test' });

    // Mid-flight: native bridge has not resolved yet. A parallel call to a
    // guarded entry-point should still fail with NOT_INITIALIZED.
    try {
      await presentCheckout({ accountId: 'acct_1', amount: 1000 });
      fail('expected presentCheckout to reject NOT_INITIALIZED');
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }

    resolveNative!();
    await initPromise;

    // After native bridge resolves, presentCheckout no longer rejects
    // NOT_INITIALIZED. With no FrameProvider mounted in tests, the next
    // expected gate is NO_PROVIDER.
    await expect(
      presentCheckout({ accountId: 'acct_1', amount: 1000 }),
    ).rejects.toMatchObject({ code: 'NO_PROVIDER' });
  });

  it('rolls back config when the native bridge rejects', async () => {
    mockInitialize.mockImplementationOnce(() => Promise.reject(new Error('native init failed')));

    await expect(
      initialize({ secretKey: 'sk_test', publishableKey: 'pk_test' }),
    ).rejects.toThrow(/native init failed/);

    try {
      await presentCheckout({ accountId: 'acct_1', amount: 1000 });
      fail('expected presentCheckout to reject NOT_INITIALIZED');
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }
  });
});

describe('presentCheckout', () => {
  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentCheckout({ accountId: 'acct_1', amount: 10000 });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
      expect(e.message).toContain('initialized');
    }
    expect(mockPresentCheckout).not.toHaveBeenCalled();
  });

  it('throws INVALID_ACCOUNT when accountId is missing', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentCheckout({ amount: 5000 } as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_ACCOUNT');
    }
    expect(mockPresentCheckout).not.toHaveBeenCalled();
  });

  it('rejects NO_PROVIDER when FrameProvider is not mounted', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await expect(
      presentCheckout({ accountId: 'acct_1', amount: 10000 }),
    ).rejects.toMatchObject({ code: 'NO_PROVIDER' });
    expect(mockPresentCheckout).not.toHaveBeenCalled();
  });
});

describe('presentCart', () => {
  const items = [
    { id: '1', title: 'Item A', amountInCents: 1000, imageUrl: 'https://example.com/a.jpg' },
  ];

  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentCart({ accountId: 'acct_1', items, shippingAmountInCents: 500 });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }
    expect(mockPresentCart).not.toHaveBeenCalled();
  });

  it('throws INVALID_ACCOUNT when accountId is missing', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentCart({ items, shippingAmountInCents: 0 } as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_ACCOUNT');
    }
    expect(mockPresentCart).not.toHaveBeenCalled();
  });

  it('rejects NO_PROVIDER when FrameProvider is not mounted', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await expect(
      presentCart({ accountId: 'acct_2', items, shippingAmountInCents: 500 }),
    ).rejects.toMatchObject({ code: 'NO_PROVIDER' });
    expect(mockPresentCart).not.toHaveBeenCalled();
  });
});

describe('presentApplePay', () => {
  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentApplePay({ amount: 100, owner: { type: 'account', id: 'acct_1' } });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }
    expect(mockPresentApplePay).not.toHaveBeenCalled();
  });

  it('throws INVALID_OWNER when owner is missing', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentApplePay({ amount: 100 } as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_OWNER');
    }
    expect(mockPresentApplePay).not.toHaveBeenCalled();
  });

  it('throws INVALID_OWNER when owner.id is empty', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentApplePay({ amount: 100, owner: { type: 'account', id: '' } });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_OWNER');
    }
    expect(mockPresentApplePay).not.toHaveBeenCalled();
  });

  // End-to-end behavior of presentApplePay (token-out + two-step settle, owner
  // routing, currency default) is covered by src/__tests__/applePay.test.ts.
});

describe('presentGooglePay', () => {
  beforeEach(() => {
    // presentGooglePay is Android-only; tests run on Android except where noted.
    mockPlatform.OS = 'android';
  });

  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentGooglePay({ amountCents: 100, owner: { type: 'account', id: 'acct_1' } });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }
    expect(mockPresentGooglePay).not.toHaveBeenCalled();
  });

  it('throws INVALID_OWNER when owner is missing', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentGooglePay({ amountCents: 100 } as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_OWNER');
    }
    expect(mockPresentGooglePay).not.toHaveBeenCalled();
  });

  it('throws INVALID_OWNER when owner.id is empty', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentGooglePay({ amountCents: 100, owner: { type: 'account', id: '' } });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_OWNER');
    }
    expect(mockPresentGooglePay).not.toHaveBeenCalled();
  });

  // End-to-end behavior of presentGooglePay (wallet config fetch, PaymentData
  // round-trip, owner routing, currency default) is covered by
  // src/__tests__/googlePay.test.ts.
});

describe('presentOnboarding', () => {
  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentOnboarding({});
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
      expect(e.message).toContain('initialized');
    }
    expect(mockPresentOnboarding).not.toHaveBeenCalled();
  });

  it('rejects NO_PROVIDER when FrameProvider is not mounted', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await expect(
      presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc', 'bank_account_verification'] }),
    ).rejects.toMatchObject({ code: 'NO_PROVIDER' });
    // Native FrameSDK.presentOnboarding no longer exists; the JS presenter
    // owns onboarding now. Verify the legacy bridge mock is never touched.
    expect(mockPresentOnboarding).not.toHaveBeenCalled();
  });
});

describe('initialize prefetch — Evervault + Sift', () => {
  // Flushes microtasks so the background `void prefetchServiceConfigs()` runs.
  const settlePrefetch = () => new Promise<void>((resolve) => setImmediate(resolve));

  it('fetches Evervault config + calls configureEvervault with the returned ids', async () => {
    await initialize({ secretKey: 'sk_1', publishableKey: 'pk_1' });
    await settlePrefetch();
    expect(getEvervaultConfigMock).toHaveBeenCalledWith();
    expect(evervaultInitMock).toHaveBeenCalledWith('team_x', 'app_x');
  });

  it('fetches Sift config in parallel with Evervault', async () => {
    await initialize({ secretKey: 'sk_1', publishableKey: 'pk_1' });
    await settlePrefetch();
    expect(getSiftConfigMock).toHaveBeenCalledWith();
  });

  it('does not call configureEvervault when backend returns null team_id', async () => {
    getEvervaultConfigMock.mockResolvedValueOnce({ team_id: null as never, app_id: 'app_x' });
    await initialize({ secretKey: 'sk_1', publishableKey: 'pk_1' });
    await settlePrefetch();
    expect(evervaultInitMock).not.toHaveBeenCalled();
  });

  it('does not throw from initialize when prefetch fails', async () => {
    getEvervaultConfigMock.mockRejectedValueOnce(new Error('network down'));
    getSiftConfigMock.mockRejectedValueOnce(new Error('network down'));
    await expect(initialize({ secretKey: 'sk_1', publishableKey: 'pk_1' })).resolves.toBeUndefined();
    await settlePrefetch();
    expect(evervaultInitMock).not.toHaveBeenCalled();
  });

  it('debugMode true → prefetch failures emit console.warn', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getEvervaultConfigMock.mockRejectedValueOnce(new Error('boom'));
    await initialize({ secretKey: 'sk_1', publishableKey: 'pk_1', debugMode: true });
    await settlePrefetch();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Evervault'));
    warnSpy.mockRestore();
  });

  it('debugMode false → prefetch failures are silent', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getEvervaultConfigMock.mockRejectedValueOnce(new Error('boom'));
    getSiftConfigMock.mockRejectedValueOnce(new Error('boom'));
    await initialize({ secretKey: 'sk_1', publishableKey: 'pk_1' });
    await settlePrefetch();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
