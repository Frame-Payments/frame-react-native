/**
 * Tests for the onboarding-session lifecycle in src/auth.ts + its integration
 * with client.ts. The token is owned by the auth module (not just the SDK
 * instance) so it survives a resetClients() mid-flow — client.ts re-applies it
 * to every freshly-built FrameSDK. Safe-clear (clear only on token match) lives
 * in auth.ts.
 */

const mockPlatform = { OS: 'ios' as 'ios' | 'android' };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

// Each MockFrameSDK instance records the session set on it, so we can assert a
// freshly-built instance (after resetClients) gets the active session re-applied.
const constructed: MockFrameSDK[] = [];

class MockFrameSDK {
  session: string | null = null;
  setOnboardingSession = jest.fn((token: string) => {
    this.session = token;
  });
  clearOnboardingSession = jest.fn((_token?: string) => {
    this.session = null;
    return true;
  });
  constructor(_config: unknown) {
    constructed.push(this);
  }
}

jest.mock('framepayments', () => ({ FrameSDK: MockFrameSDK }));

import { setConfig, resetConfig } from '../config';
import { client, resetClients, peekClient } from '../client';
import {
  beginOnboardingSession,
  endOnboardingSession,
  getActiveOnboardingSession,
  __resetOnboardingSessionForTests,
} from '../auth';
import { __resetWarnOnceForTests } from '../warn';

beforeEach(() => {
  constructed.length = 0;
  resetConfig();
  resetClients();
  __resetOnboardingSessionForTests();
  __resetWarnOnceForTests();
  setConfig({ publishableKey: 'pk_test', debugMode: false });
});

describe('beginOnboardingSession', () => {
  it('records the token in module state and applies it to the live SDK', () => {
    // Build the client first so peekClient() returns an instance.
    void client.sdk;
    beginOnboardingSession('onb_sess_abc');
    expect(getActiveOnboardingSession()).toBe('onb_sess_abc');
    expect(peekClient()!.session).toBe('onb_sess_abc');
  });

  it('warns when the token does not start with onb_sess_ (warn, do not reject)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    beginOnboardingSession('pk_wrong');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('onb_sess_'));
    expect(getActiveOnboardingSession()).toBe('pk_wrong');
    warnSpy.mockRestore();
  });

  it('does not warn for a well-formed token', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    beginOnboardingSession('onb_sess_ok');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('session survives resetClients() (the IP-prefetch race)', () => {
  it('re-applies the active session to a freshly-built SDK after resetClients', () => {
    void client.sdk; // instance A
    beginOnboardingSession('onb_sess_live');
    expect(peekClient()!.session).toBe('onb_sess_live');

    // Simulate the async IP-address prefetch landing mid-onboarding.
    resetClients();
    const rebuilt = client.sdk as unknown as MockFrameSDK; // instance B

    expect(rebuilt).not.toBe(constructed[0]);
    expect(rebuilt.session).toBe('onb_sess_live'); // re-applied, not dropped
    expect(getActiveOnboardingSession()).toBe('onb_sess_live');
  });

  it('does not re-apply a session after it has ended', () => {
    void client.sdk;
    beginOnboardingSession('onb_sess_live');
    endOnboardingSession('onb_sess_live');
    resetClients();
    const rebuilt = client.sdk as unknown as MockFrameSDK;
    expect(rebuilt.session).toBeNull();
    expect(getActiveOnboardingSession()).toBeNull();
  });
});

describe('endOnboardingSession (safe-clear)', () => {
  it('clears and returns true when the token matches', () => {
    void client.sdk;
    beginOnboardingSession('onb_sess_abc');
    expect(endOnboardingSession('onb_sess_abc')).toBe(true);
    expect(getActiveOnboardingSession()).toBeNull();
    expect(peekClient()!.session).toBeNull();
  });

  it('does NOT clear and returns false when the token does not match', () => {
    void client.sdk;
    beginOnboardingSession('onb_sess_newer');
    // A stale unmount from an older flow tries to clear its own token.
    expect(endOnboardingSession('onb_sess_stale')).toBe(false);
    expect(getActiveOnboardingSession()).toBe('onb_sess_newer'); // preserved
  });

  it('force-clears (returns true) when called with no token', () => {
    void client.sdk;
    beginOnboardingSession('onb_sess_abc');
    expect(endOnboardingSession()).toBe(true);
    expect(getActiveOnboardingSession()).toBeNull();
  });
});
