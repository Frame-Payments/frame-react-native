const canMakeApplePay = jest.fn(() => Promise.resolve(true));
const presentApplePay = jest.fn();
const finishApplePay = jest.fn(() => Promise.resolve());

const mockPlatform = { OS: 'ios' as 'ios' | 'android' };

jest.mock('react-native', () => ({
  NativeModules: {
    FrameApplePay: { canMakeApplePay, presentApplePay, finishApplePay },
  },
  Platform: mockPlatform,
}));

const ensureAttested = jest.fn(() => Promise.resolve('key_attested'));
const generateAssertionForPayment = jest.fn(() =>
  Promise.resolve({ keyId: 'key_attested', assertion: 'assertion_b64', clientData: 'client_data_b64' }),
);

jest.mock('../attestation', () => ({
  ensureAttested,
  generateAssertionForPayment,
}));

const createApplePayPaymentMethod = jest.fn();
const chargeIntentsCreate = jest.fn();
const transfersCreate = jest.fn();

jest.mock('framepayments', () => {
  class MockFrameSDK {
    paymentMethods = { createApplePayPaymentMethod };
    chargeIntents = { create: chargeIntentsCreate };
    transfers = { create: transfersCreate };
    constructor(_config: unknown) {}
  }
  return { FrameSDK: MockFrameSDK };
});

import { setConfig, resetConfig } from '../config';
import { resetClients } from '../client';
import {
  canMakeApplePay as canMakeApplePayJS,
  presentApplePayFlow,
} from '../applePay';

// `{"version":"EC_v1","data":"YWJj","signature":"sig","header":{"ephemeralPublicKey":"k","publicKeyHash":"h","transactionId":"t"}}`
// is a real-shaped ApplePayPaymentData payload, base64-encoded.
const PAYMENT_DATA_JSON =
  '{"version":"EC_v1","data":"YWJj","signature":"sig","header":{"ephemeralPublicKey":"k","publicKeyHash":"h","transactionId":"t"}}';
const PAYMENT_DATA_B64 = Buffer.from(PAYMENT_DATA_JSON, 'utf-8').toString('base64');

const SHEET_RESPONSE = {
  token: {
    paymentData: PAYMENT_DATA_B64,
    paymentMethod: { displayName: 'Visa 1234', network: 'Visa', type: 'debit' },
    transactionIdentifier: 'tx_id_1',
  },
  billingContact: { postalCode: '94105', countryCode: 'US' },
  payerName: 'Test User',
  payerEmail: 'test@example.com',
};

beforeEach(() => {
  canMakeApplePay.mockClear().mockResolvedValue(true);
  presentApplePay.mockClear().mockResolvedValue(SHEET_RESPONSE);
  finishApplePay.mockClear().mockResolvedValue(undefined);
  ensureAttested.mockClear().mockResolvedValue('key_attested');
  generateAssertionForPayment
    .mockClear()
    .mockResolvedValue({ keyId: 'key_attested', assertion: 'assertion_b64', clientData: 'client_data_b64' });
  createApplePayPaymentMethod.mockClear().mockResolvedValue({ id: 'pm_123' });
  chargeIntentsCreate.mockClear().mockResolvedValue({ id: 'ci_456' });
  transfersCreate.mockClear().mockResolvedValue({ id: 'tr_789' });
  resetConfig();
  resetClients();
  setConfig({
    publishableKey: 'pk_test',
    secretKey: 'sk_test',
    debugMode: false,
    applePayMerchantId: 'merchant.test',
  });
  mockPlatform.OS = 'ios';
});

describe('canMakeApplePay (JS wrapper)', () => {
  it('returns false on Android without calling the bridge', async () => {
    mockPlatform.OS = 'android';
    expect(await canMakeApplePayJS()).toBe(false);
    expect(canMakeApplePay).not.toHaveBeenCalled();
  });

  it('proxies to the bridge on iOS', async () => {
    expect(await canMakeApplePayJS()).toBe(true);
    expect(canMakeApplePay).toHaveBeenCalledTimes(1);
  });
});

describe('presentApplePayFlow — platform / config guards', () => {
  it('throws PLATFORM_UNSUPPORTED on Android', async () => {
    mockPlatform.OS = 'android';
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
  });

  it('throws INVALID_MERCHANT_ID when no Apple Pay merchant id is configured', async () => {
    resetConfig();
    setConfig({ publishableKey: 'pk_test', secretKey: 'sk_test', debugMode: false });
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toMatchObject({ code: 'INVALID_MERCHANT_ID' });
    expect(presentApplePay).not.toHaveBeenCalled();
  });

  it('throws INVALID_OWNER when owner is missing', async () => {
    await expect(
      presentApplePayFlow({ amount: 1000, owner: undefined as never }),
    ).rejects.toMatchObject({ code: 'INVALID_OWNER' });
  });

  it('throws INVALID_OWNER when owner.id is empty', async () => {
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'customer', id: '' } }),
    ).rejects.toMatchObject({ code: 'INVALID_OWNER' });
  });

  it('throws INVALID_OWNER when owner.type is invalid', async () => {
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'unknown' as never, id: 'x' } }),
    ).rejects.toMatchObject({ code: 'INVALID_OWNER' });
  });
});

describe('presentApplePayFlow — customer owner happy path', () => {
  it('attests, presents the sheet, creates pm + charge intent, settles success, returns intent id', async () => {
    const id = await presentApplePayFlow({
      amount: 2500,
      currency: 'usd',
      owner: { type: 'customer', id: 'cus_1' },
    });
    expect(id).toBe('ci_456');
    expect(ensureAttested).toHaveBeenCalledTimes(1);
    expect(presentApplePay).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: 'usd',
        applePayMerchantId: 'merchant.test',
        supportedNetworks: ['visa', 'masterCard', 'amex', 'discover', 'JCB'],
      }),
    );
    expect(generateAssertionForPayment).toHaveBeenCalledTimes(1);
    expect(createApplePayPaymentMethod).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'card',
        customer: 'cus_1',
        _wallet: expect.objectContaining({
          type: 'apple_pay',
          apple_pay: expect.objectContaining({
            device_key_id: 'key_attested',
            device_assertion: 'assertion_b64',
            device_client_data: 'client_data_b64',
            payerEmail: 'test@example.com',
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
        payment_method: 'pm_123',
        confirm: true,
      }),
      { usePublishableKey: true },
    );
    expect(transfersCreate).not.toHaveBeenCalled();
    expect(finishApplePay).toHaveBeenCalledWith('success');
  });

  it('parses paymentData JSON into the wallet envelope', async () => {
    await presentApplePayFlow({
      amount: 1000,
      owner: { type: 'customer', id: 'cus_1' },
    });
    const envelope = createApplePayPaymentMethod.mock.calls[0][0]._wallet;
    expect(envelope.apple_pay.details.token.paymentData).toEqual({
      version: 'EC_v1',
      data: 'YWJj',
      signature: 'sig',
      header: { ephemeralPublicKey: 'k', publicKeyHash: 'h', transactionId: 't' },
    });
    expect(envelope.apple_pay.details.token.paymentMethod).toEqual(SHEET_RESPONSE.token.paymentMethod);
    expect(envelope.apple_pay.details.token.transactionIdentifier).toBe('tx_id_1');
  });

  it('defaults currency to "usd" when omitted', async () => {
    await presentApplePayFlow({ amount: 1000, owner: { type: 'customer', id: 'cus_1' } });
    expect(presentApplePay.mock.calls[0][0].currency).toBe('usd');
    expect(chargeIntentsCreate.mock.calls[0][0].currency).toBe('usd');
  });
});

describe('presentApplePayFlow — account owner happy path', () => {
  it('routes through transfers.create with account_id + source_payment_method_id, returns transfer id', async () => {
    const id = await presentApplePayFlow({
      amount: 5000,
      currency: 'usd',
      owner: { type: 'account', id: 'acct_1' },
    });
    expect(id).toBe('tr_789');
    expect(createApplePayPaymentMethod).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'card', account: 'acct_1' }),
      { usePublishableKey: true },
    );
    expect(transfersCreate).toHaveBeenCalledWith(
      {
        amount: 5000,
        account_id: 'acct_1',
        currency: 'usd',
        source_payment_method_id: 'pm_123',
      },
      { usePublishableKey: true },
    );
    expect(chargeIntentsCreate).not.toHaveBeenCalled();
    expect(finishApplePay).toHaveBeenCalledWith('success');
  });
});

describe('presentApplePayFlow — failure paths', () => {
  it('rethrows when ensureAttested fails, never presents the sheet', async () => {
    ensureAttested.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'ATTESTATION_FAILED' }));
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toMatchObject({ code: 'ATTESTATION_FAILED' });
    expect(presentApplePay).not.toHaveBeenCalled();
    expect(finishApplePay).not.toHaveBeenCalled();
  });

  it('rethrows when the user cancels the sheet, never calls finishApplePay (sheet already gone)', async () => {
    presentApplePay.mockRejectedValueOnce(
      Object.assign(new Error('canceled'), { code: 'USER_CANCELED' }),
    );
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toMatchObject({ code: 'USER_CANCELED' });
    expect(createApplePayPaymentMethod).not.toHaveBeenCalled();
    expect(finishApplePay).not.toHaveBeenCalled();
  });

  it('settles failure when createApplePayPaymentMethod throws, then rethrows', async () => {
    createApplePayPaymentMethod.mockRejectedValueOnce(new Error('pm rejected'));
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toThrow('pm rejected');
    expect(finishApplePay).toHaveBeenCalledWith('failure');
  });

  it('settles failure when chargeIntents.create throws', async () => {
    chargeIntentsCreate.mockRejectedValueOnce(new Error('intent failed'));
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toThrow('intent failed');
    expect(finishApplePay).toHaveBeenCalledWith('failure');
  });

  it('settles failure when transfers.create throws (account owner)', async () => {
    transfersCreate.mockRejectedValueOnce(new Error('transfer failed'));
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'account', id: 'acct_1' } }),
    ).rejects.toThrow('transfer failed');
    expect(finishApplePay).toHaveBeenCalledWith('failure');
  });

  it('throws PAYMENT_FAILED when chargeIntents.create returns no id', async () => {
    chargeIntentsCreate.mockResolvedValueOnce({});
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toMatchObject({ code: 'PAYMENT_FAILED' });
    expect(finishApplePay).toHaveBeenCalledWith('failure');
  });

  it('throws PAYMENT_FAILED when transfers.create returns no id', async () => {
    transfersCreate.mockResolvedValueOnce({});
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'account', id: 'acct_1' } }),
    ).rejects.toMatchObject({ code: 'PAYMENT_FAILED' });
    expect(finishApplePay).toHaveBeenCalledWith('failure');
  });

  it('swallows finishApplePay errors after a payment failure (sheet may have already closed)', async () => {
    createApplePayPaymentMethod.mockRejectedValueOnce(new Error('boom'));
    finishApplePay.mockRejectedValueOnce(new Error('sheet already gone'));
    await expect(
      presentApplePayFlow({ amount: 1000, owner: { type: 'customer', id: 'cus_1' } }),
    ).rejects.toThrow('boom');
  });

  it('swallows a finishApplePay("success") rejection after a real payment success (sheet-already-dismissed race)', async () => {
    // Regression: if the sheet already dismissed itself between authorize and
    // settle, the native finishApplePay rejects. The real payment succeeded —
    // JS must still return the intent id, not swallow it as an error.
    finishApplePay.mockRejectedValueOnce(new Error('sheet already gone'));
    const id = await presentApplePayFlow({
      amount: 1000,
      owner: { type: 'customer', id: 'cus_1' },
    });
    expect(id).toBe('ci_456');
    expect(finishApplePay).toHaveBeenCalledWith('success');
  });
});
