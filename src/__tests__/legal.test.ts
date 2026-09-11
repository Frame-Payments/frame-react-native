jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { __resetLegalConfiguration, getLegalUrls, prefetchLegalConfiguration } from '../legal';
import { __resetRemoteConfig } from '../remoteConfig';

const FALLBACKS = {
  privacyUrl: 'https://framepayments.com/legal/privacy',
  termsUrl: 'https://framepayments.com/legal/terms',
  platformAgreementUrl: 'https://framepayments.com/legal/platform-agreement',
  cbcTermsUrl: 'https://framepayments.com/legal/cbc-terms-and-conditions',
};

function mockJson(body: unknown, ok = true) {
  global.fetch = jest.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response) as
    unknown as typeof fetch;
}

beforeEach(() => {
  __resetLegalConfiguration();
  __resetRemoteConfig();
});

describe('getLegalUrls', () => {
  it('returns the bundled fallbacks before any fetch lands', () => {
    expect(getLegalUrls()).toEqual(FALLBACKS);
  });

  it('returns the configured URLs once the prefetch lands', async () => {
    mockJson({
      legal: {
        privacy_url: 'https://example.test/p',
        terms_url: 'https://example.test/t',
        platform_agreement_url: 'https://example.test/pa',
        cbc_terms_and_conditions: 'https://example.test/cbc',
      },
    });
    await prefetchLegalConfiguration();
    expect(getLegalUrls()).toEqual({
      privacyUrl: 'https://example.test/p',
      termsUrl: 'https://example.test/t',
      platformAgreementUrl: 'https://example.test/pa',
      cbcTermsUrl: 'https://example.test/cbc',
    });
  });

  it('falls back per-field, so a partial response never yields a broken link', async () => {
    mockJson({ legal: { privacy_url: 'https://example.test/p' } });
    await prefetchLegalConfiguration();
    expect(getLegalUrls()).toEqual({ ...FALLBACKS, privacyUrl: 'https://example.test/p' });
  });

  it('ignores empty strings', async () => {
    mockJson({ legal: { privacy_url: '', terms_url: 'https://example.test/t' } });
    await prefetchLegalConfiguration();
    expect(getLegalUrls().privacyUrl).toBe(FALLBACKS.privacyUrl);
    expect(getLegalUrls().termsUrl).toBe('https://example.test/t');
  });

  it('keeps the fallbacks when the request fails', async () => {
    mockJson({}, false);
    await prefetchLegalConfiguration();
    expect(getLegalUrls()).toEqual(FALLBACKS);
  });

  it('keeps the fallbacks when the request throws', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(prefetchLegalConfiguration()).resolves.toBeUndefined();
    expect(getLegalUrls()).toEqual(FALLBACKS);
  });

  it('keeps the fallbacks when the aggregate response carries no legal block', async () => {
    mockJson({ evervault: { team_id: 't', app_id: 'a' } });
    await prefetchLegalConfiguration();
    expect(getLegalUrls()).toEqual(FALLBACKS);
  });
});
