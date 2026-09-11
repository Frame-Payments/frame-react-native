import { frameJsonPost } from './bespokeRequest';

interface ElectPayoutMethodResponse {
  payout_payment_method_id?: string | null;
}

export async function electPayoutMethod(
  accountId: string,
  paymentMethodId: string,
): Promise<string> {
  const body = await frameJsonPost<ElectPayoutMethodResponse>(
    `/v1/accounts/${encodeURIComponent(accountId)}/elect_payout_method`,
    { payment_method_id: paymentMethodId },
    'Payout-method election',
  );
  return typeof body.payout_payment_method_id === 'string'
    ? body.payout_payment_method_id
    : paymentMethodId;
}
