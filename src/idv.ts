import { getActiveOnboardingSession } from './auth';
import { getIpAddress } from './config';
import { ErrorCodes, frameError } from './errors';

// Direct-fetch wrapper for the two IDV (identity-verification) endpoints used by
// the no-SSN government-ID onboarding path:
//
//   POST /idv/session  → { inquiry_id: "inq_..." }   (pre-creates a Persona inquiry)
//   POST /idv/complete → { verified: <bool> }         (server-of-truth check)
//
// These endpoints are NOT (yet) exposed on the `framepayments` Node SDK, so we
// call them directly. Auth follows the same model the onboarding view model
// uses: while an onboarding session is active the SDK sends
// `Authorization: Bearer <onb_sess_...>`. We read that same token from the auth
// module and attach it here, so these calls are scoped to the current
// onboarding session exactly like the SDK-routed ones. `ip_address` mirrors the
// header the SDK forwards on every request (see client.ts).
//
// NOTE (FRA-5363): the JSON variant of /idv/complete is being added server-side
// separately. Until it ships, a non-JSON / error response is treated as
// "pending" (verified:false) rather than a hard failure — the UI stays on the
// SSN screen and the user can retry.

// Mirror the framepayments SDK default base URL (client.ts does not override
// `baseURL`, so the SDK talks to this host; we match it for the IDV calls).
const FRAME_API_BASE_URL = 'https://api.framepayments.com';

function idvHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
  const session = getActiveOnboardingSession();
  if (session) headers.Authorization = `Bearer ${session}`;
  const ip = getIpAddress();
  if (ip) headers.ip_address = ip;
  return headers;
}

/**
 * Create a Persona inquiry server-side and return its id. The backend pre-
 * creates the inquiry so the client launches against it via
 * `Inquiry.fromInquiry(inquiryId)`.
 */
export async function createIdvSession(): Promise<{ inquiryId: string }> {
  if (!getActiveOnboardingSession()) {
    throw frameError(
      ErrorCodes.PAYMENT_FAILED,
      'No active onboarding session. Identity verification requires an onboarding client secret.',
    );
  }
  let response: Response;
  try {
    response = await fetch(`${FRAME_API_BASE_URL}/idv/session`, {
      method: 'POST',
      headers: idvHeaders(),
      body: JSON.stringify({}),
    });
  } catch (err) {
    throw frameError(
      ErrorCodes.API_NETWORK,
      err instanceof Error ? err.message : 'Failed to reach the identity-verification service.',
    );
  }
  if (!response.ok) {
    throw frameError(
      ErrorCodes.API_ERROR,
      `Identity-verification session request failed (HTTP ${response.status}).`,
    );
  }
  let body: { inquiry_id?: unknown };
  try {
    body = (await response.json()) as { inquiry_id?: unknown };
  } catch {
    throw frameError(ErrorCodes.API_DECODE, 'Identity-verification session response was not JSON.');
  }
  const inquiryId = typeof body.inquiry_id === 'string' ? body.inquiry_id : null;
  if (!inquiryId) {
    throw frameError(ErrorCodes.API_ERROR, 'Identity-verification session returned no inquiry id.');
  }
  return { inquiryId };
}

/**
 * Ask the backend whether the Persona inquiry verified. This is the SOURCE OF
 * TRUTH for flipping the UI to verified — Persona's client-side `onComplete`
 * status is best-effort only.
 *
 * Graceful degradation (FRA-5363): if the JSON /idv/complete endpoint isn't
 * live yet (non-2xx, or a non-JSON body), we resolve with `verified:false`
 * rather than throwing, so the caller treats it as "still pending" and leaves
 * the SSN input in place instead of hard-failing the flow.
 */
export async function completeIdvSession(inquiryId: string): Promise<{ verified: boolean }> {
  let response: Response;
  try {
    response = await fetch(`${FRAME_API_BASE_URL}/idv/complete`, {
      method: 'POST',
      headers: idvHeaders(),
      body: JSON.stringify({ inquiry_id: inquiryId }),
    });
  } catch {
    // Network hiccup → treat as pending, not a hard error.
    return { verified: false };
  }
  if (!response.ok) {
    // Endpoint not live yet / transient server error → pending.
    return { verified: false };
  }
  let body: { verified?: unknown };
  try {
    body = (await response.json()) as { verified?: unknown };
  } catch {
    // Non-JSON (e.g. the JSON variant hasn't shipped) → pending.
    return { verified: false };
  }
  return { verified: body.verified === true };
}
