/**
 * Tests for the onboarding-session wrappers in src/auth.ts. These are thin
 * delegations to framepayments' setOnboardingSession / clearOnboardingSession
 * (whose precedence + safe-clear semantics are covered by framepayments' own
 * suite). Here we only verify the delegation and the RN-side onb_sess_ prefix
 * warning.
 */

const mockPlatform = { OS: 'ios' as 'ios' | 'android' };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

const setOnboardingSession = jest.fn();
const clearOnboardingSession = jest.fn((_token?: string) => true);

class MockFrameSDK {
  setOnboardingSession = setOnboardingSession;
  clearOnboardingSession = clearOnboardingSession;
  constructor(_config: unknown) {}
}

jest.mock('framepayments', () => ({ FrameSDK: MockFrameSDK }));

import { setConfig, resetConfig } from '../config';
import { resetClients } from '../client';
import { beginOnboardingSession, endOnboardingSession } from '../auth';

beforeEach(() => {
  setOnboardingSession.mockClear();
  clearOnboardingSession.mockClear();
  resetConfig();
  resetClients();
  // auth.ts reaches client.sdk, which requires a configured key.
  setConfig({ publishableKey: 'pk_test', debugMode: false });
});

describe('beginOnboardingSession', () => {
  it('forwards the token to framepayments.setOnboardingSession', () => {
    beginOnboardingSession('onb_sess_abc');
    expect(setOnboardingSession).toHaveBeenCalledWith('onb_sess_abc');
  });

  it('warns when the token does not start with onb_sess_', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    beginOnboardingSession('pk_wrong');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('onb_sess_'));
    // Still forwards the token — warn, don't reject.
    expect(setOnboardingSession).toHaveBeenCalledWith('pk_wrong');
    warnSpy.mockRestore();
  });

  it('does not warn for a well-formed token', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    beginOnboardingSession('onb_sess_ok');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('endOnboardingSession', () => {
  it('forwards the token to framepayments.clearOnboardingSession and returns its result', () => {
    clearOnboardingSession.mockReturnValueOnce(true);
    expect(endOnboardingSession('onb_sess_abc')).toBe(true);
    expect(clearOnboardingSession).toHaveBeenCalledWith('onb_sess_abc');
  });

  it('forwards undefined (force-clear) when called with no token', () => {
    endOnboardingSession();
    expect(clearOnboardingSession).toHaveBeenCalledWith(undefined);
  });

  it('returns false when framepayments safe-clear declines (token mismatch)', () => {
    clearOnboardingSession.mockReturnValueOnce(false);
    expect(endOnboardingSession('onb_sess_stale')).toBe(false);
  });
});
