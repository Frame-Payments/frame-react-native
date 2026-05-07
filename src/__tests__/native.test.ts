/**
 * Unit tests for the native module bridge (initialize, presentCheckout, presentCart).
 * NativeModules.FrameSDK is mocked.
 */

const mockInitialize = jest.fn((_secretKey: string, _publishableKey: string, _debugMode: boolean) => Promise.resolve());
const mockPresentCheckout = jest.fn((_customerId: unknown, _amount: number) => Promise.resolve({ id: 'ci_1', amount: 10000 }));
const mockPresentCart = jest.fn((_customerId: unknown, _items: unknown[], _shipping: number) => Promise.resolve({ id: 'ci_2', amount: 15000 }));
const mockPresentOnboarding = jest.fn((_accountId: unknown, _capabilities: unknown[]) => Promise.resolve({ status: 'completed', paymentMethodId: 'pm_1' }));
const mockPresentOnboardingWithApplePay = jest.fn((_accountId: unknown, _capabilities: unknown[], _merchantId: string) => Promise.resolve({ status: 'completed', paymentMethodId: 'pm_2' }));

const mockPlatform = { OS: 'ios' as 'ios' | 'android' };

jest.mock('react-native', () => ({
  NativeModules: {
    FrameSDK: {
      initialize: mockInitialize,
      presentCheckout: mockPresentCheckout,
      presentCart: mockPresentCart,
      presentOnboarding: mockPresentOnboarding,
      presentOnboardingWithApplePay: mockPresentOnboardingWithApplePay,
    },
  },
  Platform: mockPlatform,
}));

// Re-import after mock so we get the mocked NativeModules
let initialize: (opts: { secretKey: string; publishableKey: string; debugMode?: boolean }) => Promise<void>;
let presentCheckout: (opts: { customerId?: string | null; amount: number }) => Promise<unknown>;
let presentCart: (opts: {
  customerId?: string | null;
  items: Array<{ id: string; title: string; amountInCents: number; imageUrl: string }>;
  shippingAmountInCents: number;
}) => Promise<unknown>;
let presentOnboarding: (opts: { accountId?: string | null; capabilities?: string[]; applePayMerchantId?: string | null; googlePayMerchantId?: string | null }) => Promise<unknown>;

beforeEach(() => {
  jest.resetModules();
  mockInitialize.mockClear();
  mockPresentCheckout.mockClear();
  mockPresentCart.mockClear();
  mockPresentOnboarding.mockClear();
  mockPresentOnboardingWithApplePay.mockClear();
  mockPlatform.OS = 'ios';
  const native = require('../native');
  initialize = native.initialize;
  presentCheckout = native.presentCheckout;
  presentCart = native.presentCart;
  presentOnboarding = native.presentOnboarding;
});

describe('initialize', () => {
  it('calls native FrameSDK.initialize with secretKey, publishableKey, and debugMode', () => {
    initialize({ secretKey: 'sk_test_xxx', publishableKey: 'pk_test_xxx', debugMode: true });
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledWith('sk_test_xxx', 'pk_test_xxx', true);
  });

  it('defaults debugMode to false', () => {
    initialize({ secretKey: 'sk_test_yyy', publishableKey: 'pk_test_yyy' });
    expect(mockInitialize).toHaveBeenCalledWith('sk_test_yyy', 'pk_test_yyy', false);
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
});

describe('presentCheckout', () => {
  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentCheckout({ amount: 10000 });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
      expect(e.message).toContain('initialized');
    }
    expect(mockPresentCheckout).not.toHaveBeenCalled();
  });

  it('calls native presentCheckout with customerId and amount after initialize', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentCheckout({ customerId: 'cus_1', amount: 10000 });
    expect(mockPresentCheckout).toHaveBeenCalledWith('cus_1', 10000);
    expect(result).toEqual({ id: 'ci_1', amount: 10000 });
  });

  it('passes null for customerId when not provided', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentCheckout({ amount: 5000 });
    expect(mockPresentCheckout).toHaveBeenCalledWith(null, 5000);
  });
});

describe('presentCart', () => {
  const items = [
    { id: '1', title: 'Item A', amountInCents: 1000, imageUrl: 'https://example.com/a.jpg' },
  ];

  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentCart({ items, shippingAmountInCents: 500 });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }
    expect(mockPresentCart).not.toHaveBeenCalled();
  });

  it('calls native presentCart with customerId, items, shipping after initialize', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentCart({
      customerId: 'cus_2',
      items,
      shippingAmountInCents: 500,
    });
    expect(mockPresentCart).toHaveBeenCalledWith('cus_2', items, 500);
    expect(result).toEqual({ id: 'ci_2', amount: 15000 });
  });

  it('passes null for customerId when not provided', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentCart({ items, shippingAmountInCents: 0 });
    expect(mockPresentCart).toHaveBeenCalledWith(null, items, 0);
  });
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

  it('calls native presentOnboarding with accountId and capabilities after initialize', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc', 'bank_account_verification'] });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc', 'bank_account_verification'], null);
    expect(result).toEqual({ status: 'completed', paymentMethodId: 'pm_1' });
  });

  it('passes null for accountId and empty array for capabilities when not provided', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({});
    expect(mockPresentOnboarding).toHaveBeenCalledWith(null, [], null);
  });

  it('routes to presentOnboardingWithApplePay on iOS when applePayMerchantId is set', async () => {
    mockPlatform.OS = 'ios';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], applePayMerchantId: 'merchant.com.example' });
    expect(mockPresentOnboardingWithApplePay).toHaveBeenCalledWith('acct_1', ['kyc'], 'merchant.com.example');
    expect(mockPresentOnboarding).not.toHaveBeenCalled();
  });

  it('still routes to presentOnboarding on Android even when applePayMerchantId is set', async () => {
    mockPlatform.OS = 'android';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], applePayMerchantId: 'merchant.com.example' });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], null);
    expect(mockPresentOnboardingWithApplePay).not.toHaveBeenCalled();
  });

  it('forwards googlePayMerchantId to native presentOnboarding on Android', async () => {
    mockPlatform.OS = 'android';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], googlePayMerchantId: 'BCR2DN4T...' });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], 'BCR2DN4T...');
  });
});
