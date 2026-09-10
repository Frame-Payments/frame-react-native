/**
 * Tests for ensureOnboardingSession — the on-device self-mint used on the
 * publishable-key-only onboarding path (POST /v1/onboarding_sessions with
 * usePublishableKey: true). The `hasEnded` late-check and boolean return are
 * what useOnboardingViewModel's ownership tracking (FRA-6358 / FRA-6716)
 * relies on: without them a self-minted session can be installed AFTER the
 * flow has already torn its session down, leaking an account-scoped
 * onb_sess_ into every later checkout/wallet call.
 */

const mockPlatform = { OS: 'ios' as 'ios' | 'android' };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

const onboardingSessionsCreate = jest.fn();

class MockFrameSDK {
  onboardingSessions = { create: onboardingSessionsCreate };
  setOnboardingSession = jest.fn();
  clearOnboardingSession = jest.fn(() => true);
  constructor(_config: unknown) {}
}

jest.mock('framepayments', () => ({ FrameSDK: MockFrameSDK }));

import { setConfig, resetConfig } from '../config';
import { resetClients } from '../client';
import { getActiveOnboardingSession, __resetOnboardingSessionForTests } from '../auth';
import { __resetWarnOnceForTests } from '../warn';
import { ensureOnboardingSession } from '../onboardingSession';

beforeEach(() => {
  onboardingSessionsCreate.mockReset().mockResolvedValue({ client_secret: 'onb_sess_minted' });
  resetConfig();
  resetClients();
  __resetOnboardingSessionForTests();
  __resetWarnOnceForTests();
  setConfig({ publishableKey: 'pk_test', debugMode: false });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ensureOnboardingSession', () => {
  it('mints with the publishable key and installs the session, returning true', async () => {
    const result = await ensureOnboardingSession('acct_1');
    expect(result).toBe(true);
    expect(getActiveOnboardingSession()).toBe('onb_sess_minted');
    expect(onboardingSessionsCreate).toHaveBeenCalledWith(
      { account_id: 'acct_1' },
      { usePublishableKey: true },
    );
  });

  it('is idempotent — returns false and does not re-mint when a session is already active', async () => {
    await ensureOnboardingSession('acct_1');
    onboardingSessionsCreate.mockClear();

    const result = await ensureOnboardingSession('acct_1');

    expect(result).toBe(false);
    expect(onboardingSessionsCreate).not.toHaveBeenCalled();
  });

  it('returns false and warns once when the mint returns no client_secret', async () => {
    onboardingSessionsCreate.mockResolvedValue({});
    const result = await ensureOnboardingSession('acct_1');
    expect(result).toBe(false);
    expect(getActiveOnboardingSession()).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('returns false and warns once when the mint request throws', async () => {
    onboardingSessionsCreate.mockRejectedValue(new Error('network down'));
    const result = await ensureOnboardingSession('acct_1');
    expect(result).toBe(false);
    expect(getActiveOnboardingSession()).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  // The core of the ownership-leak fix: a mint that resolves AFTER the flow
  // has already torn its session down must not install the token — it would
  // have nothing left to end it, leaking an account-scoped session past
  // onboarding. Mirrors iOS's `hasEndedOnboardingSession` guard inside
  // `beginOnboardingSessionIfNeeded` (OnboardingContainerViewModel.swift:305).
  it('does not install the token when hasEnded() is true by the time the mint resolves', async () => {
    let resolveCreate!: (v: { client_secret: string }) => void;
    onboardingSessionsCreate.mockImplementationOnce(
      () => new Promise((resolve) => { resolveCreate = resolve; }),
    );

    let hasEnded = false;
    const pending = ensureOnboardingSession('acct_1', () => hasEnded);

    // Teardown races ahead of the mint — this is what the flow does when the
    // host dismisses or completion runs while the mint is still in flight.
    hasEnded = true;
    resolveCreate({ client_secret: 'onb_sess_late' });

    const result = await pending;

    expect(result).toBe(false);
    expect(getActiveOnboardingSession()).toBeNull();
  });

  it('installs the token when hasEnded() stays false through the mint', async () => {
    const result = await ensureOnboardingSession('acct_1', () => false);
    expect(result).toBe(true);
    expect(getActiveOnboardingSession()).toBe('onb_sess_minted');
  });

  it('defaults hasEnded to false when the caller passes none — the mint-only-with-no-flow-context case', async () => {
    const result = await ensureOnboardingSession('acct_1');
    expect(result).toBe(true);
  });
});
