import { client } from './client';

// Thin wrappers over framepayments' onboarding-session API (added in 2.4.0).
// The npm SDK owns the auth resolution — while a session is active, every
// request through the shared `client.sdk` instance sends
// `Authorization: Bearer <token>` (the `onb_sess_...` token), overriding the
// configured publishable/secret keys. A per-request `authToken` (object
// client_secret) still takes precedence. This mirrors the native Frame iOS
// `beginOnboardingSession` / Frame Android `beginOnboardingSession` model.
//
// We keep the iOS/Android method names here (begin/end) so the React Native
// onboarding flow reads the same as the native ports.

// One-time guard so a malformed token doesn't spam the warning on every call.
let warnedAboutSessionPrefix = false;

/**
 * Begin an onboarding session. While active, every Frame request is
 * authenticated with `token` (a server-minted `onb_sess_...` token), scoping the
 * flow to a single account and overriding the configured pk_/sk_ keys.
 *
 * Mirrors iOS `beginOnboardingSession` / Android `beginOnboardingSession`.
 */
export function beginOnboardingSession(token: string): void {
  if (!token.startsWith('onb_sess_') && !warnedAboutSessionPrefix) {
    warnedAboutSessionPrefix = true;
    console.warn(
      '[Frame] beginOnboardingSession was called with a token that does not start with "onb_sess_". ' +
        'Pass the client_secret minted by POST /v1/onboarding_sessions on your backend.',
    );
  }
  client.sdk.setOnboardingSession(token);
}

/**
 * End the active onboarding session, reverting auth to the configured pk_/sk_.
 *
 * Safe-clear: when `token` is provided, the session is cleared only if it
 * matches the currently active token, so a stale unmount cannot wipe a newer
 * session (mirrors Android's guarded teardown). The underlying safe-clear lives
 * in framepayments; we forward the token verbatim.
 *
 * @returns true if a session was cleared, false if the guard prevented it.
 */
export function endOnboardingSession(token?: string): boolean {
  return client.sdk.clearOnboardingSession(token);
}
