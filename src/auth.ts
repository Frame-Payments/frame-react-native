import { warnOnce } from './warn';

// Owns the active onboarding-session bearer token (e.g. `onb_sess_...`). While
// a session is active, every Frame request is authenticated with this token,
// overriding the configured publishable/secret keys. A per-request `authToken`
// (object client_secret) still takes precedence inside framepayments. This
// mirrors the native Frame iOS / Frame Android `beginOnboardingSession` model.
//
// The token lives HERE (module state), not only on the framepayments SDK
// instance, because client.ts rebuilds that instance on every resetClients()
// (e.g. when the async IP-address prefetch lands). client.ts reads this token
// via getActiveOnboardingSession() and re-applies it to each freshly-built SDK,
// so the session survives client churn for the lifetime of the onboarding flow.

let activeOnboardingSession: string | null = null;

// client.ts registers an applier so begin/end can push the token to the live
// SDK instance immediately (not just on the next build). Kept as a one-way
// registration to avoid an auth.ts <-> client.ts import cycle: client.ts imports
// getActiveOnboardingSession from here; nothing here statically imports client.
type SessionApplier = (token: string | null) => void;
let applyToLiveClient: SessionApplier = () => {};

export function __registerOnboardingSessionApplier(fn: SessionApplier): void {
  applyToLiveClient = fn;
}

/**
 * Returns the active onboarding-session token, or null. Read by client.ts to
 * re-apply the session to a freshly-constructed framepayments SDK instance.
 */
export function getActiveOnboardingSession(): string | null {
  return activeOnboardingSession;
}

/**
 * Begin an onboarding session. While active, every Frame request is
 * authenticated with `token` (a server-minted `onb_sess_...` token), scoping the
 * flow to a single account and overriding the configured pk_/sk_ keys.
 *
 * Mirrors iOS `beginOnboardingSession` / Android `beginOnboardingSession`.
 */
export function beginOnboardingSession(token: string): void {
  if (!token.startsWith('onb_sess_')) {
    warnOnce(
      'onb-sess-prefix',
      'beginOnboardingSession was called with a token that does not start with "onb_sess_". ' +
        'Pass the client_secret minted by POST /v1/onboarding_sessions on your backend.',
    );
  }
  activeOnboardingSession = token;
  applyToLiveClient(token);
}

/**
 * End the active onboarding session, reverting auth to the configured pk_/sk_.
 *
 * Safe-clear: when `token` is provided, the session is cleared only if it
 * matches the currently active token, so a stale unmount cannot wipe a newer
 * session (mirrors Android's guarded teardown). Omit `token` to force-clear.
 *
 * @returns true if a session was cleared, false if the guard prevented it.
 */
export function endOnboardingSession(token?: string): boolean {
  if (token !== undefined && activeOnboardingSession !== token) {
    return false;
  }
  activeOnboardingSession = null;
  applyToLiveClient(null);
  return true;
}

// Reset hook for tests so module state doesn't leak across cases.
export function __resetOnboardingSessionForTests(): void {
  activeOnboardingSession = null;
}
