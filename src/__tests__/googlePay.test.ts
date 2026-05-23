const isGooglePayReady = jest.fn(() => Promise.resolve(true));
const presentGooglePay = jest.fn();

const mockPlatform = { OS: 'android' as 'ios' | 'android' };

jest.mock('react-native', () => ({
  NativeModules: {
    FrameGooglePay: { isGooglePayReady, presentGooglePay },
  },
  Platform: mockPlatform,
}));

const getGooglePayConfiguration = jest.fn();
const createGooglePayPaymentMethod = jest.fn();
const chargeIntentsCreate = jest.fn();
const transfersCreate = jest.fn();

jest.mock('framepayments', () => {
  class MockFrameSDK {
    wallet = { getGooglePayConfiguration };
    paymentMethods = { createGooglePayPaymentMethod };
    chargeIntents = { create: chargeIntentsCreate };
    transfers = { create: transfersCreate };
    constructor(_config: unknown) {}
  }
  return { FrameSDK: MockFrameSDK };
});

import { setConfig, resetConfig } from '../config';
import { resetClients } from '../client';
import {
  isGooglePayReady as isGooglePayReadyJS,
  presentGooglePayFlow,
} from '../googlePay';

const WALLET_CONFIG = {
  identifier: 'merchant_processor_1',
  environment: 'TEST',
  processor: 'frame_gateway',
  processor_key: 'gateway_pk',
};

const SHEET_RESPONSE = {
  apiVersion: 2,
  apiVersionMinor: 0,
  email: 'gp@example.com',
  paymentMethodData: { tokenizationData: { token: 'gp_token' } },
};

beforeEach(() => {
  isGooglePayReady.mockClear().mockResolvedValue(true);
  presentGooglePay.mockClear().mockResolvedValue(SHEET_RESPONSE);
  getGooglePayConfiguration.mockClear().mockResolvedValue(WALLET_CONFIG);
  createGooglePayPaymentMethod.mockClear().mockResolvedValue({ id: 'pm_g_1' });
  chargeIntentsCreate.mockClear().mockResolvedValue({ id: 'ci_g_1' });
  transfersCreate.mockClear().mockResolvedValue({ id: 'tr_g_1' });
  resetConfig();
  resetClients();
  setConfig({
    publishableKey: 'pk_test',
    secretKey: 'sk_test',
    debugMode: false,
    googlePayMerchantId: 'BCR2DN6T...',
  });
  mockPlatform.OS = 'android';
});

describe('isGooglePayReady (JS wrapper)', () => {
  it('returns false on iOS without calling the bridge', async () => {
    mockPlatform.OS = 'ios';
    expect(await isGooglePayReadyJS()).toBe(false);
    expect(isGooglePayReady).not.toHaveBeenCalled();
  });

  it('proxies to the bridge on Android with PRODUCTION environment when debugMode=false', async () => {
    expect(await isGooglePayReadyJS()).toBe(true);
    expect(isGooglePayReady).toHaveBeenCalledWith({ environment: 'PRODUCTION' });
  });

  it('passes TEST environment when debugMode=true', async () => {
    resetConfig();
    setConfig({
      publishableKey: 'pk_test',
      secretKey: 'sk_test',
      debugMode: true,
      googlePayMerchantId: 'm',
    });
    await isGooglePayReadyJS();
    expect(isGooglePayReady).toHaveBeenCalledWith({ environment: 'TEST' });
  });

  it('returns false when the bridge rejects', async () => {
    isGooglePayReady.mockRejectedValueOnce(new Error('unsupported'));
    expect(await isGooglePayReadyJS()).toBe(false);
  });
});

describe('presentGooglePayFlow — platform / config guards', () => {
  it('throws PLATFORM_UNSUPPORTED on iOS', async () => {
    mockPlatform.OS = 'ios';
    await expect(
      presentGooglePayFlow({ amountCents: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
  });

  it('throws INVALID_MERCHANT_ID when no Google Pay merchant id is configured', async () => {
    resetConfig();
    setConfig({ publishableKey: 'pk_test', secretKey: 'sk_test', debugMode: false });
    await expect(
      presentGooglePayFlow({ amountCents: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toMatchObject({ code: 'INVALID_MERCHANT_ID' });
    expect(presentGooglePay).not.toHaveBeenCalled();
  });

  it('throws INVALID_OWNER when owner is missing', async () => {
    await expect(
      presentGooglePayFlow({ amountCents: 1000, owner: undefined as never }),
    ).rejects.toMatchObject({ code: 'INVALID_OWNER' });
  });

  it('throws INVALID_OWNER when owner.id is empty', async () => {
    await expect(
      presentGooglePayFlow({ amountCents: 1000, owner: { type: 'customer', id: '' } }),
    ).rejects.toMatchObject({ code: 'INVALID_OWNER' });
  });
});

describe('presentGooglePayFlow — customer owner happy path', () => {
  it('fetches wallet config, presents sheet, creates pm + charge intent, returns intent id', async () => {
    const id = await presentGooglePayFlow({
      amountCents: 2500,
      currencyCode: 'USD',
      owner: { type: 'customer', id: 'cus_1' },
    });
    expect(id).toBe('ci_g_1');
    expect(getGooglePayConfiguration).toHaveBeenCalledWith({ usePublishableKey: true });
    expect(presentGooglePay).toHaveBeenCalledWith({
      amountCents: 2500,
      currencyCode: 'USD',
      googlePayMerchantId: 'BCR2DN6T...',
      environment: 'PRODUCTION',
      walletConfig: WALLET_CONFIG,
    });
    expect(createGooglePayPaymentMethod).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'card',
        customer: 'cus_1',
        _wallet: expect.objectContaining({
          type: 'google_pay',
          google_pay: expect.objectContaining({
            apiVersion: 2,
            apiVersionMinor: 0,
            email: 'gp@example.com',
            paymentMethodData: { tokenizationData: { token: 'gp_token' } },
          }),
        }),
      }),
      { usePublishableKey: true },
    );
    expect(chargeIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: 'usd',
        customer: 'cus_1',
        payment_method: 'pm_g_1',
        confirm: true,
      }),
      { usePublishableKey: true },
    );
    expect(transfersCreate).not.toHaveBeenCalled();
  });

  it('uses TEST environment when debugMode=true', async () => {
    resetConfig();
    setConfig({
      publishableKey: 'pk_test',
      secretKey: 'sk_test',
      debugMode: true,
      googlePayMerchantId: 'm',
    });
    await presentGooglePayFlow({
      amountCents: 1000,
      owner: { type: 'customer', id: 'cus_1' },
    });
    expect(presentGooglePay.mock.calls[0][0].environment).toBe('TEST');
  });

  it('defaults currencyCode to "USD" when omitted', async () => {
    await presentGooglePayFlow({
      amountCents: 1000,
      owner: { type: 'customer', id: 'cus_1' },
    });
    expect(presentGooglePay.mock.calls[0][0].currencyCode).toBe('USD');
    expect(chargeIntentsCreate.mock.calls[0][0].currency).toBe('usd');
  });
});

describe('presentGooglePayFlow — account owner happy path', () => {
  it('routes through transfers.create with account_id + source_payment_method_id, returns transfer id', async () => {
    const id = await presentGooglePayFlow({
      amountCents: 5000,
      currencyCode: 'USD',
      owner: { type: 'account', id: 'acct_1' },
    });
    expect(id).toBe('tr_g_1');
    expect(createGooglePayPaymentMethod).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'card', account: 'acct_1' }),
      { usePublishableKey: true },
    );
    expect(transfersCreate).toHaveBeenCalledWith(
      {
        amount: 5000,
        account_id: 'acct_1',
        currency: 'usd',
        source_payment_method_id: 'pm_g_1',
      },
      { usePublishableKey: true },
    );
    expect(chargeIntentsCreate).not.toHaveBeenCalled();
  });
});

describe('presentGooglePayFlow — failure paths', () => {
  it('rethrows when wallet config fetch fails, never presents sheet', async () => {
    getGooglePayConfiguration.mockRejectedValueOnce(new Error('config down'));
    await expect(
      presentGooglePayFlow({ amountCents: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toThrow('config down');
    expect(presentGooglePay).not.toHaveBeenCalled();
  });

  it('rethrows when the user cancels the sheet', async () => {
    presentGooglePay.mockRejectedValueOnce(
      Object.assign(new Error('canceled'), { code: 'USER_CANCELED' }),
    );
    await expect(
      presentGooglePayFlow({ amountCents: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toMatchObject({ code: 'USER_CANCELED' });
    expect(createGooglePayPaymentMethod).not.toHaveBeenCalled();
  });

  it('rethrows when payment method creation fails', async () => {
    createGooglePayPaymentMethod.mockRejectedValueOnce(new Error('pm rejected'));
    await expect(
      presentGooglePayFlow({ amountCents: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toThrow('pm rejected');
  });

  it('throws PAYMENT_FAILED when chargeIntents.create returns no id', async () => {
    chargeIntentsCreate.mockResolvedValueOnce({});
    await expect(
      presentGooglePayFlow({ amountCents: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toMatchObject({ code: 'PAYMENT_FAILED' });
  });

  it('throws PAYMENT_FAILED when transfers.create returns no id', async () => {
    transfersCreate.mockResolvedValueOnce({});
    await expect(
      presentGooglePayFlow({ amountCents: 1000, owner: { type: 'account', id: 'acct_1' } }),
    ).rejects.toMatchObject({ code: 'PAYMENT_FAILED' });
  });
});
