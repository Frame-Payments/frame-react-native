import { fetchRemoteConfig } from './remoteConfig';

const FALLBACKS = {
  privacyUrl: 'https://framepayments.com/legal/privacy',
  termsUrl: 'https://framepayments.com/legal/terms',
  platformAgreementUrl: 'https://framepayments.com/legal/platform-agreement',
  cbcTermsUrl: 'https://framepayments.com/legal/cbc-terms-and-conditions',
} as const;

export interface LegalUrls {
  privacyUrl: string;
  termsUrl: string;
  platformAgreementUrl: string;
  cbcTermsUrl: string;
}

let cached: Partial<LegalUrls> = {};

export async function prefetchLegalConfiguration(): Promise<void> {
  const config = await fetchRemoteConfig();
  if (config?.legal) cached = config.legal;
}

export function getLegalUrls(): LegalUrls {
  return {
    privacyUrl: cached.privacyUrl ?? FALLBACKS.privacyUrl,
    termsUrl: cached.termsUrl ?? FALLBACKS.termsUrl,
    platformAgreementUrl: cached.platformAgreementUrl ?? FALLBACKS.platformAgreementUrl,
    cbcTermsUrl: cached.cbcTermsUrl ?? FALLBACKS.cbcTermsUrl,
  };
}

export function __resetLegalConfiguration(): void {
  cached = {};
}
