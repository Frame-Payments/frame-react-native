import { frameJsonPost } from './bespokeRequest';

// `POST /v1/accounts/{id}/elect_payout_method` makes an ACH payment method the
// account's payout destination. The framepayments SDK has no surface for it
// (AccountsAPI stops at disable/update), so it is hand-rolled following the
// precedent in idv.ts. Mirrors iOS
// `AccountsAPI.electPayoutMethod(accountId:request:)`
// (`Sources/Frame/Networking/Accounts/AccountsAPI.swift:227`), whose request
// body is `{ payment_method_id }`
// (`AccountRequests.swift:396-410`).

interface ElectPayoutMethodResponse {
  payout_payment_method_id?: string | null;
}

/**
 * Elects `paymentMethodId` as the account's payout destination and returns the
 * id the server settled on.
 *
 * Without this call the user finishes the payout step with a bank attached but
 * nothing designated to pay out to. iOS gates advancing on it succeeding
 * (`SelectPayoutMethodView.swift:57`), so callers should too.
 */
export async function electPayoutMethod(
  accountId: string,
  paymentMethodId: string,
): Promise<string> {
  const body = await frameJsonPost<ElectPayoutMethodResponse>(
    `/v1/accounts/${encodeURIComponent(accountId)}/elect_payout_method`,
    { payment_method_id: paymentMethodId },
    'Payout-method election',
  );
  // The server echoes the elected id; fall back to what we asked for when the
  // field is absent, matching iOS's `account.payoutPaymentMethodId ?? payoutMethod.id`.
  return typeof body.payout_payment_method_id === 'string'
    ? body.payout_payment_method_id
    : paymentMethodId;
}
