import { getActiveOnboardingSession } from './auth';
import { getIpAddress } from './config';
import { ErrorCodes, frameError } from './errors';

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
