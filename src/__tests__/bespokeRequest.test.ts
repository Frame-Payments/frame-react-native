/**
 * Tests for frameRequestHeaders' auth precedence. Ports iOS
 * FrameNetworking.bearerToken(for:)'s `.publishable` branch
 * (FrameNetworking.swift:187-201): the onboarding-session token wins while one
 * is active; otherwise the configured publishable key; a warning (not a
 * throw) when neither is present.
 *
 * Regression coverage: before this fix, frameRequestHeaders never read the
 * configured publishable key at all, so any bespoke call made before an
 * onboarding session existed (the startup /v1/config/all prefetch, or
 * checkout's Mapbox token fetch) went out with no Authorization header and
 * the backend 401'd — silently, since every caller degrades a failed fetch to
 * null/[] rather than surfacing an error.
 */

const mockPlatform = { OS: 'ios' as const };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

import { frameRequestHeaders } from '../bespokeRequest';
import { setConfig, resetConfig } from '../config';
import { beginOnboardingSession, __resetOnboardingSessionForTests } from '../auth';
import { __resetWarnOnceForTests } from '../warn';

beforeEach(() => {
  resetConfig();
  __resetOnboardingSessionForTests();
  __resetWarnOnceForTests();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('frameRequestHeaders', () => {
  it('authenticates with the publishable key when no onboarding session is active', () => {
    setConfig({ publishableKey: 'pk_test_123' });
    expect(frameRequestHeaders().Authorization).toBe('Bearer pk_test_123');
  });

  it('prefers the onboarding session over the publishable key once one begins', () => {
    setConfig({ publishableKey: 'pk_test_123' });
    beginOnboardingSession('onb_sess_abc');
    expect(frameRequestHeaders().Authorization).toBe('Bearer onb_sess_abc');
  });

  it('sends no Authorization header and warns once when neither is configured', () => {
    frameRequestHeaders();
    frameRequestHeaders();
    expect(frameRequestHeaders().Authorization).toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no publishable key'));
  });

  it('still sets Content-Type/Accept/extra headers when unauthenticated', () => {
    const headers = frameRequestHeaders({ 'X-Custom': '1' });
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('application/json');
    expect(headers['X-Custom']).toBe('1');
  });
});
