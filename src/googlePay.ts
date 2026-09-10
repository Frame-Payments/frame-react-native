import { NativeModules, Platform } from 'react-native';
import { currentSessionId, sessionIdForPayment } from './sonarSession';
import { client, requireSecretKeyFor } from './client';
import { ErrorCodes, frameError } from './errors';
import { getDebugMode, getGooglePayMerchantId, getIpAddress } from './config';
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
  // The charge step (chargeIntents/transfers create) is server-only and needs a
  // secret key. Fail before opening the Google Pay sheet so a publishable-key-
  // only app doesn't prompt the user for a payment that can't complete.
  requireSecretKeyFor('Google Pay charge');
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
    // A ChargeIntent has no account to resolve a session through, but iOS's
    // `accountId: nil` read is NOT "no session" — it reads the legacy
    // pre-account slot (`SonarSessionStorage.currentSessionId(accountId:)`,
    // `SonarSessionObjects.swift:95`), which every charge intent carries
    // regardless of owner. Never blocks: a missing session leaves the field
    // absent and the server's own rejection (if any) is authoritative.
    const sonarSessionId = await currentSessionId(null);
    const intent = await client.sdk.chargeIntents.create({
      amount: options.amountCents,
      currency: currency.toLowerCase(),
      customer: owner.id,
      payment_method: pm.id,
      confirm: true,
      ...(sonarSessionId ? { sonar_session_id: sonarSessionId } : {}),
      // fraud_signals isn't declared on CreateChargeIntentParams — same
      // runtime-safe-cast pattern used elsewhere for wire fields the npm SDK
      // omits. Mirrors iOS's automatic client_ip injection on every charge
      // intent (`ChargeIntentsAPI.swift:53-56`).
      ...(getIpAddress() ? { fraud_signals: { client_ip: getIpAddress() } } : {}),
    } as unknown as Parameters<typeof client.sdk.chargeIntents.create>[0]);
    if (!intent || typeof intent.id !== 'string') {
      throw frameError(ErrorCodes.PAYMENT_FAILED, 'Frame returned no ChargeIntent id.');
    }
    return intent.id;
  }

  const pm = await client.sdk.paymentMethods.createGooglePayPaymentMethod(
    { type: 'card', account: owner.id, _wallet: wallet },
    { usePublishableKey: true },
  );
  const sonarSessionId = await sessionIdForPayment(owner.id);
  const transfer = await client.sdk.transfers.create({
    amount: options.amountCents,
    account_id: owner.id,
    currency: currency.toLowerCase(),
    source_payment_method_id: pm.id,
    ...(sonarSessionId ? { sonar_session_id: sonarSessionId } : {}),
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
