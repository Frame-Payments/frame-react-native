import { frameRequestHeaders } from './bespokeRequest';
import { FRAME_API_BASE_URL } from './client';

// Frame's legal document URLs. Ports iOS LegalConfiguration
// (`Sources/Frame/Networking/LegalConfiguration.swift`): fetched from the
// configuration API at SDK init, cached, then read synchronously by SDK UI. If
// the fetch fails and nothing is cached, each accessor falls back to a
// hardcoded URL so the SDK never renders a broken link.
//
// Hardcoding these in the component (as RN did, for two of the four) means a
// legal-URL change ships to iOS via config but needs an SDK release on RN.
//
// getLegalConfiguration has no framepayments surface, so the fetch goes through
// the shared bespoke-request helper. iOS caches in the keychain; RN caches in
// memory for the process — a missed cache costs one request on the next cold
// start rather than a broken link, since the fallbacks are always there.

const FALLBACKS = {
  privacyUrl: 'https://framepayments.com/legal/privacy',
  termsUrl: 'https://framepayments.com/legal/terms',
  platformAgreementUrl: 'https://framepayments.com/legal/platform-agreement',
  cbcTermsUrl: 'https://framepayments.com/legal/cbc-terms-and-conditions',
} as const;

/** Frame's legal document URLs. */
export interface LegalUrls {
  privacyUrl: string;
  termsUrl: string;
  platformAgreementUrl: string;
  cbcTermsUrl: string;
}

let cached: Partial<LegalUrls> = {};

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Fetches the legal URLs and caches them for the process. Called in the
 * background from Frame.initialize; failures are swallowed, since every
 * accessor falls back to a bundled default.
 */
export async function prefetchLegalConfiguration(): Promise<void> {
  try {
    const response = await fetch(`${FRAME_API_BASE_URL}/v1/config/legal`, {
      method: 'GET',
      headers: frameRequestHeaders(),
    });
    if (!response.ok) return;
    const body = (await response.json()) as Record<string, unknown>;
    cached = {
      privacyUrl: nonEmpty(body.privacy_url),
      termsUrl: nonEmpty(body.terms_url),
      platformAgreementUrl: nonEmpty(body.platform_agreement_url),
      // iOS decodes this one as `cbcTermsAndConditions`, so the wire name is
      // the un-suffixed form rather than `cbc_terms_url`.
      cbcTermsUrl: nonEmpty(body.cbc_terms_and_conditions),
    };
  } catch {
    // Fallbacks cover it.
  }
}

/**
 * Frame's legal document URLs — the configured values when the prefetch landed,
 * otherwise the bundled defaults. Synchronous, so UI can read it during render.
 */
export function getLegalUrls(): LegalUrls {
  return {
    privacyUrl: cached.privacyUrl ?? FALLBACKS.privacyUrl,
    termsUrl: cached.termsUrl ?? FALLBACKS.termsUrl,
    platformAgreementUrl: cached.platformAgreementUrl ?? FALLBACKS.platformAgreementUrl,
    cbcTermsUrl: cached.cbcTermsUrl ?? FALLBACKS.cbcTermsUrl,
  };
}

/** Test hook — clears the cached configuration. */
export function __resetLegalConfiguration(): void {
  cached = {};
}
