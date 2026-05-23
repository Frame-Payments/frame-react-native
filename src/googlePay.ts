import { NativeModules, Platform } from 'react-native';
import { client } from './client';
import { ErrorCodes, frameError } from './errors';
import { getDebugMode, getGooglePayMerchantId } from './config';
import type { PresentGooglePayOptions, WalletOwner } from './types';

const LINKING_ERROR =
  "The native module 'FrameGooglePay' isn't linked. Rebuild the Android app.";

export interface GooglePayWalletConfig {
  identifier: string | null;
  environment: string | null;
  processor: string | null;
  processor_key: string | null;
}

export interface GooglePayBridgePresentArgs {
  amountCents: number;
  currencyCode: string;
  googlePayMerchantId: string;
  environment: 'TEST' | 'PRODUCTION';
  walletConfig: GooglePayWalletConfig;
}

export interface GooglePayBridgeResponse {
  apiVersion: number;
  apiVersionMinor: number;
  email?: string | null;
  paymentMethodData: Record<string, unknown>;
}

interface GooglePayNative {
  isGooglePayReady(args: { environment: 'TEST' | 'PRODUCTION' }): Promise<boolean>;
  presentGooglePay(args: GooglePayBridgePresentArgs): Promise<GooglePayBridgeResponse>;
}

const FrameGooglePay: GooglePayNative = NativeModules.FrameGooglePay
  ? NativeModules.FrameGooglePay
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      },
    ) as unknown as GooglePayNative);

export async function isGooglePayReady(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const environment = getDebugMode() ? 'TEST' : 'PRODUCTION';
  try {
    return await FrameGooglePay.isGooglePayReady({ environment });
  } catch {
    return false;
  }
}

/**
 * Google Pay token-out flow.
 *   1. Fetch wallet config from Frame (gateway processor + processor merchant id).
 *   2. Open the Google Pay sheet via the bridge; receive `PaymentData` JSON.
 *   3. Create the Google Pay payment method via frame-node (publishable key).
 *   4. Create a ChargeIntent (customer owner) or Transfer (account owner).
 */
export async function presentGooglePayFlow(options: PresentGooglePayOptions): Promise<string> {
  if (Platform.OS !== 'android') {
    throw frameError(ErrorCodes.PLATFORM_UNSUPPORTED, 'Frame.presentGooglePay is Android-only; use presentApplePay on iOS.');
  }
  validateOwner(options.owner);
  const merchantId = getGooglePayMerchantId();
  if (!merchantId) {
    throw frameError(
      ErrorCodes.INVALID_MERCHANT_ID,
      'No Google Pay merchant ID configured. Pass `googlePayMerchantId` to Frame.initialize(...).',
    );
  }

  const environment: 'TEST' | 'PRODUCTION' = getDebugMode() ? 'TEST' : 'PRODUCTION';
  const walletConfig = await client.sdk.wallet.getGooglePayConfiguration({ usePublishableKey: true });

  const sheetResponse = await FrameGooglePay.presentGooglePay({
    amountCents: options.amountCents,
    currencyCode: options.currencyCode ?? 'USD',
    googlePayMerchantId: merchantId,
    environment,
    walletConfig,
  });

  return createPaymentMethodAndCharge(options, sheetResponse);
}

async function createPaymentMethodAndCharge(
  options: PresentGooglePayOptions,
  sheetResponse: GooglePayBridgeResponse,
): Promise<string> {
  const owner = options.owner;
  const currency = options.currencyCode ?? 'USD';

  const wallet = {
    type: 'google_pay' as const,
    google_pay: {
      apiVersion: sheetResponse.apiVersion,
      apiVersionMinor: sheetResponse.apiVersionMinor,
      email: sheetResponse.email,
      paymentMethodData: sheetResponse.paymentMethodData,
    },
  };

  if (owner.type === 'customer') {
    const pm = await client.sdk.paymentMethods.createGooglePayPaymentMethod(
      { type: 'card', customer: owner.id, _wallet: wallet },
      { usePublishableKey: true },
    );
    const intent = await client.sdk.chargeIntents.create({
      amount: options.amountCents,
      currency: currency.toLowerCase(),
      customer: owner.id,
      payment_method: pm.id,
      confirm: true,
    });
    if (!intent || typeof intent.id !== 'string') {
      throw frameError(ErrorCodes.PAYMENT_FAILED, 'Frame returned no ChargeIntent id.');
    }
    return intent.id;
  }

  const pm = await client.sdk.paymentMethods.createGooglePayPaymentMethod(
    { type: 'card', account: owner.id, _wallet: wallet },
    { usePublishableKey: true },
  );
  const transfer = await client.sdk.transfers.create({
    amount: options.amountCents,
    account_id: owner.id,
    currency: currency.toLowerCase(),
    source_payment_method_id: pm.id,
  });
  if (!transfer || typeof transfer.id !== 'string') {
    throw frameError(ErrorCodes.PAYMENT_FAILED, 'Frame returned no Transfer id.');
  }
  return transfer.id;
}

function validateOwner(owner: WalletOwner): void {
  if (!owner || (owner.type !== 'customer' && owner.type !== 'account')) {
    throw frameError(
      ErrorCodes.INVALID_OWNER,
      'presentGooglePay requires owner: { type: "customer" | "account", id: string }',
    );
  }
  if (!owner.id) {
    throw frameError(ErrorCodes.INVALID_OWNER, 'presentGooglePay requires owner.id');
  }
}
