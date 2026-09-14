import { getActiveOnboardingSession } from './auth';
import { client } from './client';
import { isTransportError } from './api-errors';
import { ErrorCodes, frameError } from './errors';

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
  let inquiryId: string;
  try {
    ({ inquiry_id: inquiryId } = await client.sdk.idv.createSession());
  } catch (err) {
    throw frameError(
      isTransportError(err) ? ErrorCodes.API_NETWORK : ErrorCodes.API_ERROR,
      err instanceof Error ? err.message : 'Failed to reach the identity-verification service.',
    );
  }
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
  let body: Awaited<ReturnType<typeof client.sdk.idv.completeSession>>;
  try {
    body = await client.sdk.idv.completeSession(inquiryId);
  } catch {
    // Network error, non-2xx, or undecodable body → unknown, not an
    // authoritative "not verified".
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
