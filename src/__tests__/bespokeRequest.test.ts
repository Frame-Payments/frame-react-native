
const mockPlatform = { OS: 'ios' as const };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

import { frameRequestHeaders } from '../bespokeRequest';
import { setConfig, resetConfig } from '../config';
import { beginOnboardingSession, __resetOnboardingSessionForTests } from '../auth';
import { __resetWarnOnceForTests } from '../warn';
import { SDK_VERSION } from '../client';

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

  // Regression (FRA-6716 #18): iOS sends the SDK version on its own header on
  // every request (FrameNetworking.swift:283-288); bespoke calls previously
  // never sent it, leaving this traffic unversioned on the wire.
  it('always sends X-Frame-SDK-Version', () => {
    expect(frameRequestHeaders()['X-Frame-SDK-Version']).toBe(SDK_VERSION);
  });
});
