import { getActiveOnboardingSession } from './auth';
import { getIpAddress } from './config';
import { frameApiBaseUrl, frameUserAgent } from './client';
import { ErrorCodes, frameError } from './errors';

// The framepayments SDK has no API surface for the `/v1/idv/*` endpoints and
// exposes no generic request hook, so these calls are hand-rolled. They must
// still route identically to every SDK request: same base URL, same User-Agent
// (which the backend uses to select its native-SDK code path) and same
// `ip_address` header. Those values are imported from client.ts rather than
// duplicated so the two never drift.
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
  const userAgent = frameUserAgent();
  if (userAgent) headers['User-Agent'] = userAgent;
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
    response = await fetch(`${frameApiBaseUrl()}/v1/idv/session`, {
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
 * Result of confirming an IDV inquiry with the backend.
 *   - `'verified'`     — the backend authoritatively confirmed identity.
 *   - `'not_verified'` — the backend returned a well-formed `verified: false`,
 *                        i.e. an authoritative "not verified yet" answer.
 *   - `'pending'`      — the answer is unknown: a network error, a non-2xx
 *                        response, or a non-JSON body. Callers must NOT treat
 *                        this as "not verified" — after the user has already
 *                        completed Persona it means "try again in a moment".
 */
export type IdvCompletionStatus = 'verified' | 'not_verified' | 'pending';

export async function completeIdvSession(inquiryId: string): Promise<IdvCompletionStatus> {
  let response: Response;
  try {
    response = await fetch(`${frameApiBaseUrl()}/v1/idv/complete`, {
      method: 'POST',
      headers: idvHeaders(),
      body: JSON.stringify({ inquiry_id: inquiryId }),
    });
  } catch {
    // Network hiccup → unknown, not an authoritative "not verified".
    return 'pending';
  }
  if (!response.ok) {
    // Endpoint not live yet / transient server error → unknown.
    return 'pending';
  }
  let body: { verified?: unknown };
  try {
    body = (await response.json()) as { verified?: unknown };
  } catch {
    // Non-JSON (e.g. the JSON variant hasn't shipped) → unknown.
    return 'pending';
  }
  return body.verified === true ? 'verified' : 'not_verified';
}
