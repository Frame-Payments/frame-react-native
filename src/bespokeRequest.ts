import { getActiveOnboardingSession } from './auth';
import { getIpAddress, getPublishableKey } from './config';
import { FRAME_API_BASE_URL, frameUserAgent } from './client';
import { ErrorCodes, frameError } from './errors';
import { warnOnce } from './warn';

// A few Frame endpoints have no surface on the framepayments SDK and it exposes
// no generic request hook, so those calls are hand-rolled. They must still route
// identically to every SDK request: same base URL, same User-Agent (which the
// backend uses to select its native-SDK code path), same `ip_address` header,
// and the same auth precedence the SDK itself applies to a client-safe
// (publishable-scoped) request.
//
// Auth precedence ports iOS FrameNetworking.bearerToken(for:)'s `.publishable`
// branch (FrameNetworking.swift:187-201): the onboarding-session token wins
// while one is active; otherwise the publishable key. There is no secret-key
// fallback here — every current bespoke caller (config, IDV) is a client-safe
// endpoint, so a bespoke call needing sk_ auth should go through the
// framepayments SDK client instead, not this helper.
//
// Without a session or a publishable key, the request goes out with no
// Authorization header at all and the backend 401s — the bug this guards:
// requests issued before any onboarding session exists (e.g. the startup
// /v1/config/all prefetch, or checkout's own config reads) previously had no
// fallback to the configured pk_, so they silently failed even when the
// backend account was fully configured.
export function frameRequestHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
  const session = getActiveOnboardingSession();
  const publishableKey = getPublishableKey();
  if (session) {
    headers.Authorization = `Bearer ${session}`;
  } else if (publishableKey) {
    headers.Authorization = `Bearer ${publishableKey}`;
  } else {
    warnOnce(
      'bespoke-no-auth',
      'A Frame request was made with no active onboarding session and no publishable key configured. ' +
        'Call Frame.initialize({ publishableKey }) first.',
    );
  }
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
