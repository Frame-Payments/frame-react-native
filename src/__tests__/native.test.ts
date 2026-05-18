/**
 * Unit tests for the native module bridge (initialize, presentCheckout, presentCart,
 * presentApplePay, presentGooglePay, presentOnboarding). NativeModules.FrameSDK is mocked.
 */

const mockInitialize = jest.fn((_secretKey: string, _publishableKey: string, _debugMode: boolean, _applePayMerchantId: string | null, _googlePayMerchantId: string | null, _theme: unknown) => Promise.resolve());
const mockPresentCheckout = jest.fn((_accountId: unknown, _amount: number) => Promise.resolve('tr_1'));
const mockPresentCart = jest.fn((_accountId: unknown, _items: unknown[], _shipping: number) => Promise.resolve('tr_2'));
const mockPresentApplePay = jest.fn((_ownerType: string, _ownerId: string, _amount: number, _currency: string) => Promise.resolve('tr_3'));
const mockPresentGooglePay = jest.fn((_amountCents: number, _ownerType: string, _ownerId: string, _currencyCode: string) => Promise.resolve('tr_4'));
const mockPresentOnboarding = jest.fn((_accountId: unknown, _capabilities: unknown[]) => Promise.resolve({ status: 'completed', paymentMethodId: 'pm_1' }));

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

  it('calls native presentCheckout with accountId and amount; resolves with transfer id string', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentCheckout({ accountId: 'acct_1', amount: 10000 });
    expect(mockPresentCheckout).toHaveBeenCalledWith('acct_1', 10000);
    expect(result).toBe('tr_1');
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

  it('forwards account owner; resolves with transfer id string', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx', applePayMerchantId: 'merchant.test' });
    const result = await presentApplePay({
      amount: 12345,
      currency: 'usd',
      owner: { type: 'account', id: 'acct_1' },
    });
    expect(mockPresentApplePay).toHaveBeenCalledWith('account', 'acct_1', 12345, 'usd');
    expect(result).toBe('tr_3');
  });

  it('forwards customer owner; resolves with charge intent id string', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx', applePayMerchantId: 'merchant.test' });
    await presentApplePay({
      amount: 9999,
      owner: { type: 'customer', id: 'cus_1' },
    });
    expect(mockPresentApplePay).toHaveBeenCalledWith('customer', 'cus_1', 9999, 'usd');
  });

  it('defaults currency to usd', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx', applePayMerchantId: 'merchant.test' });
    await presentApplePay({ amount: 100, owner: { type: 'account', id: 'acct_1' } });
    expect(mockPresentApplePay).toHaveBeenCalledWith('account', 'acct_1', 100, 'usd');
  });
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

  it('forwards account owner; resolves with transfer id string', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx', googlePayMerchantId: 'BCR2DN4T...' });
    const result = await presentGooglePay({
      amountCents: 9999,
      owner: { type: 'account', id: 'acct_1' },
      currencyCode: 'EUR',
    });
    expect(mockPresentGooglePay).toHaveBeenCalledWith(9999, 'account', 'acct_1', 'EUR');
    expect(result).toBe('tr_4');
  });

  it('forwards customer owner; resolves with charge intent id string', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx', googlePayMerchantId: 'BCR2DN4T...' });
    await presentGooglePay({
      amountCents: 4242,
      owner: { type: 'customer', id: 'cus_1' },
    });
    expect(mockPresentGooglePay).toHaveBeenCalledWith(4242, 'customer', 'cus_1', 'USD');
  });

  it('defaults currencyCode to USD', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx', googlePayMerchantId: 'BCR2DN4T...' });
    await presentGooglePay({ amountCents: 100, owner: { type: 'account', id: 'acct_1' } });
    expect(mockPresentGooglePay).toHaveBeenCalledWith(100, 'account', 'acct_1', 'USD');
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

  it('calls native presentOnboarding with accountId and capabilities only — no merchant params', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc', 'bank_account_verification'] });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc', 'bank_account_verification']);
    expect(result).toEqual({ status: 'completed', paymentMethodId: 'pm_1' });
  });

  it('passes null accountId and empty array for capabilities when not provided', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({});
    expect(mockPresentOnboarding).toHaveBeenCalledWith(null, []);
  });

  it('behaves the same on Android — merchant IDs are init-only across both platforms', async () => {
    mockPlatform.OS = 'android';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx', googlePayMerchantId: 'BCR2DN4T...' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'] });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc']);
  });
});
