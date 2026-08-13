/**
 * Unit tests for the native module bridge (initialize, presentCheckout, presentCart,
 * presentApplePay, presentGooglePay, presentOnboarding, presentAddPaymentMethod,
 * presentAddPayoutMethod). NativeModules.FrameSDK is mocked.
 */

const mockInitialize = jest.fn((_secretKey: string | null, _publishableKey: string, _debugMode: boolean, _applePayMerchantId: string | null, _googlePayMerchantId: string | null, _theme: unknown) => Promise.resolve());
const mockPresentCheckout = jest.fn((_accountId: unknown, _amount: number) => Promise.resolve('tr_1'));
const mockPresentCart = jest.fn((_accountId: unknown, _items: unknown[], _shipping: number) => Promise.resolve('tr_2'));
const mockPresentApplePay = jest.fn((_ownerType: string, _ownerId: string, _amount: number, _currency: string) => Promise.resolve('tr_3'));
const mockPresentGooglePay = jest.fn((_amountCents: number, _ownerType: string, _ownerId: string, _currencyCode: string) => Promise.resolve('tr_4'));
// Mirrors the iOS shape as of frame-ios 4.3.6: onboarding resolves the account id,
// not a payment method id. Android still resolves `paymentMethodId`.
const mockPresentOnboarding = jest.fn((_accountId: unknown, _capabilities: unknown[]) => Promise.resolve({ status: 'completed', accountId: 'acct_1' }));
const mockPresentAddPaymentMethod = jest.fn((_accountId: string, _clientSecret: string | null) => Promise.resolve({ status: 'completed', methodId: 'pm_2' }));
const mockPresentAddPayoutMethod = jest.fn((_accountId: string, _clientSecret: string | null) => Promise.resolve({ status: 'completed', methodId: 'ba_1' }));
const mockResetDeviceAttestation = jest.fn(() => Promise.resolve());

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
      presentAddPaymentMethod: mockPresentAddPaymentMethod,
      presentAddPayoutMethod: mockPresentAddPayoutMethod,
      resetDeviceAttestation: mockResetDeviceAttestation,
    },
  },
  Platform: mockPlatform,
}));

// Re-import after mock so we get the mocked NativeModules
let initialize: (opts: { secretKey?: string; publishableKey: string; debugMode?: boolean; applePayMerchantId?: string; googlePayMerchantId?: string }) => Promise<void>;
let presentCheckout: (opts: { accountId: string; amount: number }) => Promise<string>;
let presentCart: (opts: {
  accountId: string;
  items: Array<{ id: string; title: string; amountInCents: number; imageUrl: string }>;
  shippingAmountInCents: number;
}) => Promise<string>;
let presentApplePay: (opts: { amount: number; currency?: string; owner: { type: 'customer' | 'account'; id: string } }) => Promise<string>;
let presentGooglePay: (opts: { amountCents: number; owner: { type: 'customer' | 'account'; id: string }; currencyCode?: string }) => Promise<string>;
let presentOnboarding: (opts: { accountId?: string | null; capabilities?: string[]; showIntroScreen?: boolean; showCompletionScreen?: boolean; clientSecret?: string | null }) => Promise<unknown>;
let presentAddPaymentMethod: (opts: { accountId: string; clientSecret?: string | null }) => Promise<unknown>;
let presentAddPayoutMethod: (opts: { accountId: string; clientSecret?: string | null }) => Promise<unknown>;
let resetDeviceAttestation: () => Promise<void>;

beforeEach(() => {
  jest.resetModules();
  mockInitialize.mockClear();
  mockPresentCheckout.mockClear();
  mockPresentCart.mockClear();
  mockPresentApplePay.mockClear();
  mockPresentGooglePay.mockClear();
  mockPresentOnboarding.mockClear();
  mockPresentAddPaymentMethod.mockClear();
  mockPresentAddPayoutMethod.mockClear();
  mockResetDeviceAttestation.mockClear();
  mockPlatform.OS = 'ios';
  const native = require('../native');
  initialize = native.initialize;
  presentCheckout = native.presentCheckout;
  presentCart = native.presentCart;
  presentApplePay = native.presentApplePay;
  presentGooglePay = native.presentGooglePay;
  presentOnboarding = native.presentOnboarding;
  presentAddPaymentMethod = native.presentAddPaymentMethod;
  presentAddPayoutMethod = native.presentAddPayoutMethod;
  resetDeviceAttestation = native.resetDeviceAttestation;
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

  it('allows omitting secretKey on iOS and marshals null (publishable-key-first)', () => {
    initialize({ publishableKey: 'pk_test' });
    expect(mockInitialize).toHaveBeenCalledWith(null, 'pk_test', false, null, null, null);
  });

  it('allows omitting secretKey on Android too and marshals null', () => {
    mockPlatform.OS = 'android';
    initialize({ publishableKey: 'pk_test' });
    expect(mockInitialize).toHaveBeenCalledWith(null, 'pk_test', false, null, null, null);
  });

  it('throws if publishableKey is missing', () => {
    expect(() => initialize({ secretKey: 'sk_test', publishableKey: '' })).toThrow(/publishableKey/);
    expect(() => (initialize as any)({ secretKey: 'sk_test' })).toThrow(/publishableKey/);
    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it('throws if publishableKey is missing on Android as well', () => {
    mockPlatform.OS = 'android';
    expect(() => initialize({ secretKey: 'sk_test', publishableKey: '' })).toThrow(/publishableKey/);
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

  it('calls native presentOnboarding with showIntroScreen=true and showCompletionScreen=true by default', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc', 'bank_account_verification'] });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc', 'bank_account_verification'], true, true, null);
    expect(result).toEqual({ status: 'completed', accountId: 'acct_1' });
  });

  it('passes null accountId, empty capabilities, and both screen flags=true when options are omitted', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({});
    expect(mockPresentOnboarding).toHaveBeenCalledWith(null, [], true, true, null);
  });

  it('passes showIntroScreen=false when explicitly set', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], showIntroScreen: false });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], false, true, null);
  });

  it('passes showCompletionScreen=false when explicitly set', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], showCompletionScreen: false });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], true, false, null);
  });

  it('passes both screen flags=false when both are explicitly set', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], showIntroScreen: false, showCompletionScreen: false });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], false, false, null);
  });

  it('passes clientSecret through when provided', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], clientSecret: 'onb_sess_123' });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], true, true, 'onb_sess_123');
  });

  it('passes clientSecret through on Android — frame-android 3.x honors it', async () => {
    mockPlatform.OS = 'android';
    await initialize({ publishableKey: 'pk_xxx' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'], clientSecret: 'onb_sess_123' });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], true, true, 'onb_sess_123');
  });

  it('behaves the same on Android — merchant IDs are init-only across both platforms', async () => {
    mockPlatform.OS = 'android';
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx', googlePayMerchantId: 'BCR2DN4T...' });
    await presentOnboarding({ accountId: 'acct_1', capabilities: ['kyc'] });
    expect(mockPresentOnboarding).toHaveBeenCalledWith('acct_1', ['kyc'], true, true, null);
  });
});

describe('presentAddPaymentMethod', () => {
  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentAddPaymentMethod({ accountId: 'acct_1' });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }
    expect(mockPresentAddPaymentMethod).not.toHaveBeenCalled();
  });

  it('throws INVALID_ACCOUNT when accountId is missing', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentAddPaymentMethod({} as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_ACCOUNT');
    }
    expect(mockPresentAddPaymentMethod).not.toHaveBeenCalled();
  });

  it('throws PLATFORM_UNSUPPORTED on Android without touching the native module', async () => {
    mockPlatform.OS = 'android';
    await initialize({ publishableKey: 'pk_xxx' });
    try {
      await presentAddPaymentMethod({ accountId: 'acct_1' });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('PLATFORM_UNSUPPORTED');
    }
    expect(mockPresentAddPaymentMethod).not.toHaveBeenCalled();
  });

  it('calls native presentAddPaymentMethod with accountId and null clientSecret by default', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentAddPaymentMethod({ accountId: 'acct_1' });
    expect(mockPresentAddPaymentMethod).toHaveBeenCalledWith('acct_1', null);
    expect(result).toEqual({ status: 'completed', methodId: 'pm_2' });
  });

  it('passes clientSecret through when provided', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentAddPaymentMethod({ accountId: 'acct_1', clientSecret: 'onb_sess_123' });
    expect(mockPresentAddPaymentMethod).toHaveBeenCalledWith('acct_1', 'onb_sess_123');
  });
});

describe('presentAddPayoutMethod', () => {
  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentAddPayoutMethod({ accountId: 'acct_1' });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }
    expect(mockPresentAddPayoutMethod).not.toHaveBeenCalled();
  });

  it('throws INVALID_ACCOUNT when accountId is missing', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    try {
      await presentAddPayoutMethod({} as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_ACCOUNT');
    }
    expect(mockPresentAddPayoutMethod).not.toHaveBeenCalled();
  });

  it('throws PLATFORM_UNSUPPORTED on Android without touching the native module', async () => {
    mockPlatform.OS = 'android';
    await initialize({ publishableKey: 'pk_xxx' });
    try {
      await presentAddPayoutMethod({ accountId: 'acct_1' });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('PLATFORM_UNSUPPORTED');
    }
    expect(mockPresentAddPayoutMethod).not.toHaveBeenCalled();
  });

  it('calls native presentAddPayoutMethod with accountId and null clientSecret by default', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    const result = await presentAddPayoutMethod({ accountId: 'acct_1' });
    expect(mockPresentAddPayoutMethod).toHaveBeenCalledWith('acct_1', null);
    expect(result).toEqual({ status: 'completed', methodId: 'ba_1' });
  });

  it('passes clientSecret through when provided', async () => {
    await initialize({ secretKey: 'sk_xxx', publishableKey: 'pk_xxx' });
    await presentAddPayoutMethod({ accountId: 'acct_1', clientSecret: 'onb_sess_123' });
    expect(mockPresentAddPayoutMethod).toHaveBeenCalledWith('acct_1', 'onb_sess_123');
  });
});

describe('resetDeviceAttestation', () => {
  it('forwards to the native module on iOS', async () => {
    await resetDeviceAttestation();
    expect(mockResetDeviceAttestation).toHaveBeenCalledTimes(1);
  });

  it('propagates a native ATTESTATION_FAILED rejection', async () => {
    const failure = Object.assign(new Error('Re-attestation after reset failed'), {
      code: 'ATTESTATION_FAILED',
    });
    mockResetDeviceAttestation.mockRejectedValueOnce(failure);
    await expect(resetDeviceAttestation()).rejects.toMatchObject({ code: 'ATTESTATION_FAILED' });
  });

  it('throws PLATFORM_UNSUPPORTED on Android without touching the native module', () => {
    mockPlatform.OS = 'android';
    // The platform guard runs before the bridge call and `resetDeviceAttestation`
    // is not async, so this throws synchronously rather than rejecting.
    expect(() => resetDeviceAttestation()).toThrow(
      expect.objectContaining({ code: 'PLATFORM_UNSUPPORTED' }),
    );
    expect(mockResetDeviceAttestation).not.toHaveBeenCalled();
  });
});
