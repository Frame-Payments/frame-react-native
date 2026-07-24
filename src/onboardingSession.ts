import { client } from './client';
import { beginOnboardingSession, getActiveOnboardingSession } from './auth';
import { warnOnce } from './warn';

// Mints an account-scoped onboarding session on-device so that the rest of the
// onboarding flow — most importantly the no-SSN IDV calls in idv.ts, which
// authenticate ONLY when `getActiveOnboardingSession()` is truthy — goes out
// with a valid `onb_sess_...` bearer instead of falling back to the raw pk_/sk_.
//
// `POST /v1/onboarding_sessions` accepts a PUBLISHABLE key (the backend has
// `allow_publishable_key(:create)`), so we force the pk_ via
// `{ usePublishableKey: true }` — no secret key leaves the device. The session
// is account-bound, so we mint it right AFTER account creation, once the id is
// known. Mirrors iOS `OnboardingContainerViewModel.beginOnboardingSessionIfNeeded`
// (which calls `createOnboardingSessionWithPublishableKey`).

/**
 * Ensure an onboarding session is active for `accountId`, minting one with the
 * configured publishable key if the host did not already supply one.
 *
 * Idempotent and non-fatal:
 *   • Returns early if a session is already active (host-supplied `clientSecret`
 *     or a prior mint) — never mints twice.
 *   • On any failure, warns once and returns rather than throwing, so a mint
 *     hiccup doesn't wedge the flow. Downstream `createIdvSession()` still
 *     guards on the session being present and surfaces a clear error there.
 */
export async function ensureOnboardingSession(accountId: string): Promise<void> {
  if (getActiveOnboardingSession()) return;
  try {
    const session = await client.sdk.onboardingSessions.create(
      { account_id: accountId },
      { usePublishableKey: true },
    );
    const clientSecret = session?.client_secret;
    if (!clientSecret) {
      warnOnce(
        'onb-sess-mint-empty',
        'POST /v1/onboarding_sessions returned no client_secret; onboarding requests will fall back to the configured key.',
      );
      return;
    }
    beginOnboardingSession(clientSecret);
  } catch (err) {
    warnOnce(
      'onb-sess-mint-failed',
      `Failed to mint an onboarding session (${err instanceof Error ? err.message : 'unknown error'}); ` +
        'onboarding requests will fall back to the configured key.',
    );
  }
}
