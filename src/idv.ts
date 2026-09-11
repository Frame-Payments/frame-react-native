import { getActiveOnboardingSession } from './auth';
import { FRAME_API_BASE_URL } from './client';
import { frameRequestHeaders as idvHeaders } from './bespokeRequest';
import { ErrorCodes, frameError } from './errors';

// The framepayments SDK has no API surface for the `/v1/idv/*` endpoints and

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
    response = await fetch(`${FRAME_API_BASE_URL}/v1/idv/session`, {
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

export interface IdvCompletion {
  status: IdvCompletionStatus;
  category?: string;
  rawStatus?: string;
  failureType?: string;
  retriable?: boolean;
}

export function idvFailureMessage(completion: IdvCompletion, mandatory = false): string {
  switch (completion.category) {
    case 'terminal':
      return "We couldn't verify your identity. Please contact support if you think this is a mistake.";
    case 'review':
      return "Your verification is in review. We'll be in touch once it's complete.";
    case 'retriable_with_new_data':
      return "Some of your details didn't match. Please check them and try again.";
    case 'step_up':
      return 'We need a government ID to finish verifying your identity.';
    case 'transient':
      return "We couldn't complete the check just now. Please try again.";
    default:
      break;
  }

  switch (completion.rawStatus) {
    case 'declined':
    case 'failed':
      return "We couldn't verify your identity. Please contact support if you think this is a mistake.";
    case 'needs_review':
      return "Your verification is in review. We'll be in touch once it's complete.";
    default:
      return mandatory
        ? "We couldn't verify your identity. Please try again."
        : "We couldn't verify your identity. Please try again or enter your Social Security Number.";
  }
}

export async function completeIdvSessionDetailed(inquiryId: string): Promise<IdvCompletion> {
  let response: Response;
  try {
    response = await fetch(`${FRAME_API_BASE_URL}/v1/idv/complete`, {
      method: 'POST',
      headers: idvHeaders(),
      body: JSON.stringify({ inquiry_id: inquiryId }),
    });
  } catch {
    // Network hiccup → unknown, not an authoritative "not verified".
    return { status: 'pending' };
  }
  if (!response.ok) {
    // Endpoint not live yet / transient server error → unknown.
    return { status: 'pending' };
  }
  let body: {
    verified?: unknown;
    category?: unknown;
    status?: unknown;
    failure_type?: unknown;
    retriable?: unknown;
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // Non-JSON (e.g. the JSON variant hasn't shipped) → unknown.
    return { status: 'pending' };
  }
  const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);
  return {
    status: body.verified === true ? 'verified' : 'not_verified',
    category: str(body.category),
    rawStatus: str(body.status),
    failureType: str(body.failure_type),
    retriable: typeof body.retriable === 'boolean' ? body.retriable : undefined,
  };
}

export async function completeIdvSession(inquiryId: string): Promise<IdvCompletionStatus> {
  return (await completeIdvSessionDetailed(inquiryId)).status;
}
