import { getActiveOnboardingSession } from './auth';
import { getIpAddress, getPublishableKey } from './config';
import { FRAME_API_BASE_URL, frameUserAgent } from './client';
import { ErrorCodes, frameError } from './errors';
import { warnOnce } from './warn';

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
