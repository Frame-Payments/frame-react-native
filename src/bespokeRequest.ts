import { getActiveOnboardingSession } from './auth';
import { getIpAddress } from './config';
import { FRAME_API_BASE_URL, frameUserAgent } from './client';
import { ErrorCodes, frameError } from './errors';

// A few Frame endpoints have no surface on the framepayments SDK and it exposes
// no generic request hook, so those calls are hand-rolled. They must still route
// identically to every SDK request: same base URL, same User-Agent (which the
// backend uses to select its native-SDK code path), same `ip_address` header,
// and the same onboarding-session bearer when one is active. Those values are
// imported from client.ts / auth.ts rather than duplicated so they can't drift.

export function frameRequestHeaders(extra?: Record<string, string>): Record<string, string> {
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
 * POST a JSON body to a Frame API path and decode the JSON response.
 * `label` names the operation in the error messages ("Payout-method election").
 */
export async function frameJsonPost<T>(
  path: string,
  body: unknown,
  label: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${FRAME_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: frameRequestHeaders(),
      body: JSON.stringify(body ?? {}),
    });
  } catch (err) {
    throw frameError(
      ErrorCodes.API_NETWORK,
      err instanceof Error ? err.message : `${label} could not reach the Frame API.`,
    );
  }
  if (!response.ok) {
    throw frameError(ErrorCodes.API_ERROR, `${label} failed (HTTP ${response.status}).`);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw frameError(ErrorCodes.API_DECODE, `${label} response was not JSON.`);
  }
}
