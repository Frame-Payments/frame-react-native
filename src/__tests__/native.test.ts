/**
 * Unit tests for the native module bridge (initialize, presentCheckout, presentCart,
 * presentApplePay, presentGooglePay, presentOnboarding). NativeModules.FrameSDK is mocked.
 */

const mockInitialize = jest.fn((_secretKey: string, _publishableKey: string, _debugMode: boolean) => Promise.resolve());
const mockPresentCheckout = jest.fn((_accountId: unknown, _amount: number) => Promise.resolve('tr_1'));
const mockPresentCart = jest.fn((_accountId: unknown, _items: unknown[], _shipping: number) => Promise.resolve('tr_2'));
const mockPresentApplePay = jest.fn((_ownerType: string, _ownerId: string, _amount: number, _currency: string, _merchantId: string) => Promise.resolve('tr_3'));
const mockPresentGooglePay = jest.fn((_amountCents: number, _accountId: string, _currencyCode: string, _googlePayMerchantId: string | null) => Promise.resolve('tr_4'));
const mockPresentOnboarding = jest.fn((_accountId: unknown, _capabilities: unknown[], _merchantId: string | null) => Promise.resolve({ status: 'completed', paymentMethodId: 'pm_1' }));

const mockPlatform = { OS: 'ios' as 'ios' | 'android' };

jest.mock('react-native', () => ({
  NativeModules: {
    FrameSDK: {
      initialize: mockInitialize,
      presentCheckout: mockPresentCheckout,
      presentCart: mockPresentCart,
      presentApplePay: mockPresentApplePay,
      presentGooglePay: mockPresentGooglePay,
      presentOnboarding: mockPresentOnboarding,
    },
  },
  Platform: mockPlatform,
}));

// Re-import after mock so we get the mocked NativeModules
let initialize: (opts: { secretKey: string; publishableKey: string; debugMode?: boolean }) => Promise<void>;
let presentCheckout: (opts: { accountId?: string | null; amount: number }) => Promise<string>;
let presentCart: (opts: {
  accountId?: string | null;
  items: Array<{ id: string; title: string; amountInCents: number; imageUrl: string }>;
  shippingAmountInCents: number;
}) => Promise<string>;
let presentApplePay: (opts: { amount: number; currency?: string; owner: { type: 'customer' | 'account'; id: string }; merchantId: string }) => Promise<string>;
let presentGooglePay: (opts: { amountCents: number; accountId: string; currencyCode?: string; googlePayMerchantId?: string }) => Promise<string>;
let presentOnboarding: (opts: { accountId?: string | null; capabilities?: string[]; applePayMerchantId?: string | null; googlePayMerchantId?: string | null }) => Promise<unknown>;

beforeEach(() => {
  jest.resetModules();
  mockInitialize.mockClear();
  mockPresentCheckout.mockClear();
  mockPresentCart.mockClear();
  mockPresentApplePay.mockClear();
  mockPresentGooglePay.mockClear();
  mockPresentOnboarding.mockClear();
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
  it('calls native FrameSDK.initialize with secretKey, publishableKey, and debugMode', () => {
    initialize({ secretKey: 'sk_test_xxx', publishableKey: 'pk_test_xxx', debugMode: true });
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledWith('sk_test_xxx', 'pk_test_xxx', true, null);
  });

  it('defaults debugMode to false', () => {
    initialize({ secretKey: 'sk_test_yyy', publishableKey: 'pk_test_yyy' });
    expect(mockInitialize).toHaveBeenCalledWith('sk_test_yyy', 'pk_test_yyy', false, null);
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

  it('calls native presentCheckout with accountId and amount; resolves with transfer id string', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentCheckout({ accountId: 'acct_1', amount: 10000 });
    expect(mockPresentCheckout).toHaveBeenCalledWith('acct_1', 10000);
    expect(result).toBe('tr_1');
  });

  it('passes null for accountId when not provided', async () => {
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

  it('calls native presentCart with accountId, items, shipping; resolves with transfer id string', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentCart({
      accountId: 'acct_2',
      items,
      shippingAmountInCents: 500,
    });
    expect(mockPresentCart).toHaveBeenCalledWith('acct_2', items, 500);
    expect(result).toBe('tr_2');
  });

  it('passes null for accountId when not provided', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentCart({ items, shippingAmountInCents: 0 });
    expect(mockPresentCart).toHaveBeenCalledWith(null, items, 0);
  });
});

describe('presentApplePay', () => {
  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentApplePay({ amount: 100, owner: { type: 'account', id: 'acct_1' }, merchantId: 'merchant.test' });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }
    expect(mockPresentApplePay).not.toHaveBeenCalled();
  });

  it('throws INVALID_OWNER when owner is missing', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentApplePay({ amount: 100, merchantId: 'merchant.test' } as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_OWNER');
    }
    expect(mockPresentApplePay).not.toHaveBeenCalled();
  });

  it('throws INVALID_OWNER when owner.id is empty', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentApplePay({ amount: 100, owner: { type: 'account', id: '' }, merchantId: 'merchant.test' });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_OWNER');
    }
    expect(mockPresentApplePay).not.toHaveBeenCalled();
  });

  it('throws INVALID_MERCHANT_ID when merchantId is missing', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentApplePay({ amount: 100, owner: { type: 'account', id: 'acct_1' } } as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_MERCHANT_ID');
    }
    expect(mockPresentApplePay).not.toHaveBeenCalled();
  });

  it('forwards account owner; resolves with transfer id string', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentApplePay({
      amount: 12345,
      currency: 'usd',
      owner: { type: 'account', id: 'acct_1' },
      merchantId: 'merchant.test',
    });
    expect(mockPresentApplePay).toHaveBeenCalledWith('account', 'acct_1', 12345, 'usd', 'merchant.test');
    expect(result).toBe('tr_3');
  });

  it('forwards customer owner; resolves with charge intent id string', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentApplePay({
      amount: 9999,
      owner: { type: 'customer', id: 'cus_1' },
      merchantId: 'merchant.test',
    });
    expect(mockPresentApplePay).toHaveBeenCalledWith('customer', 'cus_1', 9999, 'usd', 'merchant.test');
  });

  it('defaults currency to usd', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentApplePay({ amount: 100, owner: { type: 'account', id: 'acct_1' }, merchantId: 'merchant.test' });
    expect(mockPresentApplePay).toHaveBeenCalledWith('account', 'acct_1', 100, 'usd', 'merchant.test');
  });
});

describe('presentGooglePay', () => {
  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentGooglePay({ amountCents: 100, accountId: 'acct_1' });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }
    expect(mockPresentGooglePay).not.toHaveBeenCalled();
  });

  it('throws INVALID_ACCOUNT when accountId is missing', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentGooglePay({ amountCents: 100 } as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_ACCOUNT');
    }
    expect(mockPresentGooglePay).not.toHaveBeenCalled();
  });

  it('calls native presentGooglePay with positional args; resolves with transfer id string', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentGooglePay({
      amountCents: 9999,
      accountId: 'acct_1',
      currencyCode: 'EUR',
      googlePayMerchantId: 'BCR2DN4T...',
    });
    expect(mockPresentGooglePay).toHaveBeenCalledWith(9999, 'acct_1', 'EUR', 'BCR2DN4T...');
    expect(result).toBe('tr_4');
  });

  it('defaults currencyCode to USD and merchantId to null', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentGooglePay({ amountCents: 100, accountId: 'acct_1' });
    expect(mockPresentGooglePay).toHaveBeenCalledWith(100, 'acct_1', 'USD', null);
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

  it('calls native presentOnboarding with accountId, capabilities, and null merchantId after initialize on iOS', async () => {
    mockPlatform.OS = 'ios';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc', 'bank_account_verification'] });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc', 'bank_account_verification'], null);
    expect(result).toEqual({ status: 'completed', paymentMethodId: 'pm_1' });
  });

  it('passes null for accountId and empty array for capabilities when not provided on iOS', async () => {
    mockPlatform.OS = 'ios';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({});
    expect(mockPresentOnboarding).toHaveBeenCalledWith(null, [], null);
  });

  it('forwards applePayMerchantId on iOS', async () => {
    mockPlatform.OS = 'ios';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], applePayMerchantId: 'merchant.com.example' });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], 'merchant.com.example');
  });

  it('ignores applePayMerchantId on Android', async () => {
    mockPlatform.OS = 'android';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], applePayMerchantId: 'merchant.com.example' });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], null);
  });

  it('forwards googlePayMerchantId to native presentOnboarding on Android', async () => {
    mockPlatform.OS = 'android';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], googlePayMerchantId: 'BCR2DN4T...' });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], 'BCR2DN4T...');
  });

  it('ignores googlePayMerchantId on iOS', async () => {
    mockPlatform.OS = 'ios';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], googlePayMerchantId: 'BCR2DN4T...' });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], null);
  });
});
