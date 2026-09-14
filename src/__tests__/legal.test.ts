jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mockGetAllConfiguration = jest.fn();
jest.mock('framepayments', () => {
  class MockFrameSDK {
    configuration = { getAllConfiguration: () => mockGetAllConfiguration() };
    constructor(_config: unknown) {}
  }
  return { FrameSDK: MockFrameSDK };
});

import { setConfig, resetConfig } from '../config';
import { resetClients } from '../client';
import { __resetLegalConfiguration, getLegalUrls, prefetchLegalConfiguration } from '../legal';
import { __resetRemoteConfig } from '../remoteConfig';

const FALLBACKS = {
  privacyUrl: 'https://framepayments.com/legal/privacy',
  termsUrl: 'https://framepayments.com/legal/terms',
  platformAgreementUrl: 'https://framepayments.com/legal/platform-agreement',
  cbcTermsUrl: 'https://framepayments.com/legal/cbc-terms-and-conditions',
};

function mockOnce(body: unknown) {
  mockGetAllConfiguration.mockImplementationOnce(async () => body);
}

function mockRejectOnce(err: unknown) {
  mockGetAllConfiguration.mockImplementationOnce(async () => {
    throw err;
  });
}

beforeEach(() => {
  __resetLegalConfiguration();
  __resetRemoteConfig();
  resetConfig();
  resetClients();
  setConfig({ publishableKey: 'pk_test_x', debugMode: false });
  mockGetAllConfiguration.mockClear();
});

describe('getLegalUrls', () => {
  it('returns the bundled fallbacks before any fetch lands', () => {
    expect(getLegalUrls()).toEqual(FALLBACKS);
  });

  it('returns the configured URLs once the prefetch lands', async () => {
    mockOnce({
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
    mockOnce({ legal: { privacy_url: 'https://example.test/p' } });
    await prefetchLegalConfiguration();
    expect(getLegalUrls()).toEqual({ ...FALLBACKS, privacyUrl: 'https://example.test/p' });
  });

  it('ignores empty strings', async () => {
    mockOnce({ legal: { privacy_url: '', terms_url: 'https://example.test/t' } });
    await prefetchLegalConfiguration();
    expect(getLegalUrls().privacyUrl).toBe(FALLBACKS.privacyUrl);
    expect(getLegalUrls().termsUrl).toBe('https://example.test/t');
  });

  it('keeps the fallbacks when the request fails', async () => {
    mockRejectOnce(new Error('HTTP 503'));
    await prefetchLegalConfiguration();
    expect(getLegalUrls()).toEqual(FALLBACKS);
  });

  it('keeps the fallbacks when the request throws', async () => {
    mockRejectOnce(new Error('offline'));
    await expect(prefetchLegalConfiguration()).resolves.toBeUndefined();
    expect(getLegalUrls()).toEqual(FALLBACKS);
  });

  it('keeps the fallbacks when the aggregate response carries no legal block', async () => {
    mockOnce({ evervault: { team_id: 't', app_id: 'a' } });
    await prefetchLegalConfiguration();
    expect(getLegalUrls()).toEqual(FALLBACKS);
  });
});
