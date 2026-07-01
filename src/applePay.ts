import { NativeModules, Platform } from 'react-native';
import type { ApplePayPaymentData } from 'framepayments';
import { client, requireSecretKeyFor } from './client';
import { ErrorCodes, frameError } from './errors';
import { ensureAttested, generateAssertionForPayment } from './attestation';
import { getApplePayMerchantId } from './config';
import type { PresentApplePayOptions, WalletOwner } from './types';

const LINKING_ERROR =
  "The native module 'FrameApplePay' isn't linked. Run `pod install` and rebuild the app.";

export interface ApplePayBridgePresentArgs {
  amount: number;
  currency: string;
  applePayMerchantId: string;
  countryCode?: string;
  supportedNetworks?: ReadonlyArray<string>;
}

export interface ApplePayBridgeToken {
  paymentData: string;
  paymentMethod: { displayName: string; network: string; type: string };
  transactionIdentifier: string;
}

export interface ApplePayBridgeResponse {
  token: ApplePayBridgeToken;
  billingContact?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    countryCode?: string;
  };
  payerName?: string;
  payerEmail?: string;
}

interface ApplePayNative {
  canMakeApplePay(): Promise<boolean>;
  presentApplePay(args: ApplePayBridgePresentArgs): Promise<ApplePayBridgeResponse>;
  finishApplePay(status: 'success' | 'failure'): Promise<void>;
}

const FrameApplePay: ApplePayNative = NativeModules.FrameApplePay
  ? NativeModules.FrameApplePay
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      },
    ) as unknown as ApplePayNative);

// Apple's standard set of supported networks for in-app payment requests. Mirrors
// `ApplePayPresenter.swift` in the legacy Frame iOS bridge.
const DEFAULT_SUPPORTED_NETWORKS: ReadonlyArray<string> = ['visa', 'masterCard', 'amex', 'discover', 'JCB'];

export async function canMakeApplePay(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return FrameApplePay.canMakeApplePay();
}

/**
 * Apple Pay token-out flow.
 *   1. Ensure the device is attested (App Attest).
 *   2. Present the PKPaymentAuthorizationController sheet via the bridge.
 *   3. Generate a device assertion bound to the payment token.
 *   4. Create the Apple Pay payment method via frame-node (publishable key).
 *   5. Create a ChargeIntent (customer owner) or Transfer (account owner).
 *   6. Settle the still-open Apple Pay sheet — success on success, failure on
 *      any exception — so the spinner-stays-up UX matches the native flow.
 */
export async function presentApplePayFlow(options: PresentApplePayOptions): Promise<string> {
  if (Platform.OS !== 'ios') {
    throw frameError(ErrorCodes.PLATFORM_UNSUPPORTED, 'Frame.presentApplePay is iOS-only; use presentGooglePay on Android.');
  }
  validateOwner(options.owner);
  // The charge step (chargeIntents/transfers create) is server-only and needs a
  // secret key. Fail before opening the Apple Pay sheet so a publishable-key-
  // only app doesn't prompt the user for a payment that can't complete.
  requireSecretKeyFor('Apple Pay charge');
  const merchantId = getApplePayMerchantId();
  if (!merchantId) {
    throw frameError(
      ErrorCodes.INVALID_MERCHANT_ID,
      'No Apple Pay merchant ID configured. Pass `applePayMerchantId` to Frame.initialize(...).',
    );
  }

  await ensureAttested();

  const sheetResponse = await FrameApplePay.presentApplePay({
    amount: options.amount,
    currency: options.currency ?? 'usd',
    applePayMerchantId: merchantId,
    supportedNetworks: DEFAULT_SUPPORTED_NETWORKS,
  });

  try {
    const id = await createPaymentMethodAndCharge(options, sheetResponse);
    // Settle through the safe wrapper too: if the native sheet already
    // dismissed itself (background/foreground race), we still need to
    // return the successful id — not blow up the payment that succeeded.
    await safeFinishApplePay('success');
    return id;
  } catch (err) {
    await safeFinishApplePay('failure');
    throw err;
  }
}

/**
 * Apple Pay "add to owner" flow. Presents the sheet, attests the device,
 * creates a tokenized Apple Pay payment method via frame-node, then settles
 * the sheet — but does NOT create a ChargeIntent or Transfer. Used by the
 * onboarding AddPaymentMethod screen so the host app can collect a saved
 * Apple Pay token for the account / customer.
 *
 * The presented sheet renders a $1.00 placeholder line item because Apple
 * Pay requires a non-zero amount to draw the authorization UI. The amount
 * is never charged.
 */
export async function addApplePayToOwnerFlow(
  options: { owner: WalletOwner; currency?: string },
): Promise<string> {
  if (Platform.OS !== 'ios') {
    throw frameError(
      ErrorCodes.PLATFORM_UNSUPPORTED,
      'Frame Apple Pay add-to-owner is iOS-only.',
    );
  }
  validateOwner(options.owner);
  const merchantId = getApplePayMerchantId();
  if (!merchantId) {
    throw frameError(
      ErrorCodes.INVALID_MERCHANT_ID,
      'No Apple Pay merchant ID configured. Pass `applePayMerchantId` to Frame.initialize(...).',
    );
  }

  await ensureAttested();

  const currency = options.currency ?? 'usd';
  // Apple Pay needs a non-zero amount on the request to draw the sheet. We
  // use $1.00 (100 cents) — it's a label only, no charge is created.
  const sheetResponse = await FrameApplePay.presentApplePay({
    amount: 100,
    currency,
    applePayMerchantId: merchantId,
    supportedNetworks: DEFAULT_SUPPORTED_NETWORKS,
  });

  try {
    const wallet = await buildAppleWalletEnvelope(sheetResponse);
    const params =
      options.owner.type === 'customer'
        ? { type: 'card' as const, customer: options.owner.id, _wallet: wallet }
        : { type: 'card' as const, account: options.owner.id, _wallet: wallet };
    const pm = await client.sdk.paymentMethods.createApplePayPaymentMethod(params, {
      usePublishableKey: true,
    });
    if (!pm || typeof pm.id !== 'string') {
      throw frameError(ErrorCodes.PAYMENT_METHOD_FAILED, 'Frame returned no payment method id.');
    }
    await safeFinishApplePay('success');
    return pm.id;
  } catch (err) {
    await safeFinishApplePay('failure');
    throw err;
  }
}

async function buildAppleWalletEnvelope(sheetResponse: ApplePayBridgeResponse) {
  const paymentDataBytes = base64ToBytes(sheetResponse.token.paymentData);
  const assertion = await generateAssertionForPayment(paymentDataBytes);
  const paymentData = parsePaymentDataJson(sheetResponse.token.paymentData);
  return {
    type: 'apple_pay' as const,
    apple_pay: {
      requestId: cryptoRandomUUID(),
      methodName: 'https://apple.com/apple-pay' as const,
      payerName: sheetResponse.payerName,
      payerEmail: sheetResponse.payerEmail,
      details: {
        token: {
          paymentData,
          paymentMethod: sheetResponse.token.paymentMethod,
          transactionIdentifier: sheetResponse.token.transactionIdentifier,
        },
        billingContact: sheetResponse.billingContact,
      },
      device_key_id: assertion.keyId,
      device_assertion: assertion.assertion,
      device_client_data: assertion.clientData,
    },
  };
}

async function createPaymentMethodAndCharge(
  options: PresentApplePayOptions,
  sheetResponse: ApplePayBridgeResponse,
): Promise<string> {
  const paymentDataBytes = base64ToBytes(sheetResponse.token.paymentData);
  const assertion = await generateAssertionForPayment(paymentDataBytes);

  const paymentData = parsePaymentDataJson(sheetResponse.token.paymentData);
  const currency = options.currency ?? 'usd';
  const owner = options.owner;

  const wallet = {
    type: 'apple_pay' as const,
    apple_pay: {
      requestId: cryptoRandomUUID(),
      methodName: 'https://apple.com/apple-pay' as const,
      payerName: sheetResponse.payerName,
      payerEmail: sheetResponse.payerEmail,
      details: {
        token: {
          paymentData,
          paymentMethod: sheetResponse.token.paymentMethod,
          transactionIdentifier: sheetResponse.token.transactionIdentifier,
        },
        billingContact: sheetResponse.billingContact,
      },
      device_key_id: assertion.keyId,
      device_assertion: assertion.assertion,
      device_client_data: assertion.clientData,
    },
  };

  if (owner.type === 'customer') {
    const pm = await client.sdk.paymentMethods.createApplePayPaymentMethod(
      { type: 'card', customer: owner.id, _wallet: wallet },
      { usePublishableKey: true },
    );
    const intent = await client.sdk.chargeIntents.create({
      amount: options.amount,
      currency,
      customer: owner.id,
      payment_method: pm.id,
      confirm: true,
    });
    if (!intent || typeof intent.id !== 'string') {
      throw frameError(ErrorCodes.PAYMENT_FAILED, 'Frame returned no ChargeIntent id.');
    }
    return intent.id;
  }

  const pm = await client.sdk.paymentMethods.createApplePayPaymentMethod(
    { type: 'card', account: owner.id, _wallet: wallet },
    { usePublishableKey: true },
  );
  const transfer = await client.sdk.transfers.create({
    amount: options.amount,
    account_id: owner.id,
    currency,
    source_payment_method_id: pm.id,
  });
  if (!transfer || typeof transfer.id !== 'string') {
    throw frameError(ErrorCodes.PAYMENT_FAILED, 'Frame returned no Transfer id.');
  }
  return transfer.id;
}

async function safeFinishApplePay(status: 'success' | 'failure'): Promise<void> {
  try {
    await FrameApplePay.finishApplePay(status);
  } catch {
    // The sheet may have closed already on the native side (e.g. user
    // backgrounded the app). Best-effort cleanup.
  }
}

function validateOwner(owner: WalletOwner): void {
  if (!owner || (owner.type !== 'customer' && owner.type !== 'account')) {
    throw frameError(
      ErrorCodes.INVALID_OWNER,
      'presentApplePay requires owner: { type: "customer" | "account", id: string }',
    );
  }
  if (!owner.id) {
    throw frameError(ErrorCodes.INVALID_OWNER, 'presentApplePay requires owner.id');
  }
}

// PKPaymentToken.paymentData is a JSON dict that PassKit produces. We parse it
// here so frame-node receives the wallet envelope's nested shape exactly the
// way Frame's backend expects (per ApplePayRequests.swift).
function parsePaymentDataJson(base64: string): ApplePayPaymentData {
  const json = atobUtf8(base64);
  return JSON.parse(json) as ApplePayPaymentData;
}

function atobUtf8(b64: string): string {
  return globalThis.atob ? globalThis.atob(b64) : Buffer.from(b64, 'base64').toString('utf-8');
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob ? globalThis.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function cryptoRandomUUID(): string {
  const g: unknown = globalThis;
  if (
    typeof g === 'object' &&
    g !== null &&
    'crypto' in g &&
    typeof (g as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID === 'function'
  ) {
    return (g as { crypto: { randomUUID: () => string } }).crypto.randomUUID();
  }
  // RFC4122 v4 fallback.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
