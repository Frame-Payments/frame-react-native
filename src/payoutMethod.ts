import { client } from './client';
import { isTransportError } from './api-errors';
import { ErrorCodes, frameError } from './errors';

// Account has no payout field to read back, so this is just the caller's id.
export async function electPayoutMethod(
  accountId: string,
  paymentMethodId: string,
): Promise<string> {
  try {
    await client.sdk.accounts.electPayoutMethod(accountId, paymentMethodId);
  } catch (err) {
    throw frameError(
      isTransportError(err) ? ErrorCodes.API_NETWORK : ErrorCodes.API_ERROR,
      err instanceof Error ? err.message : 'Payout-method election failed.',
    );
  }
  return paymentMethodId;
}
