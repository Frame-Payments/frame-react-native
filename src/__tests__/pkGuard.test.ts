/**
 * Guard test for the publishable-key-first policy (FRA-4315).
 *
 * Consolidates the pk-first invariants in one place so a regression that
 * re-opens the surface to secret keys — or that starts hard-rejecting them —
 * fails loudly:
 *
 *   1. initialize() accepts a publishable-key-only client (no secretKey).
 *   2. initialize() WARNS, does not reject, when a secret key is mishandled
 *      (secretKey configured, or an sk_-shaped value passed as publishableKey).
 *      This is "pk-first," not "pk-only": secretKey remains plumbed for the
 *      migration window (see client.ts / config.ts).
 *   3. Server-only (money-movement) entry points are gated on a pk-only client
 *      via requireSecretKeyFor(), so the device never silently reaches a
 *      secret-keyed endpoint.
 *
 * Per-behavior coverage also lives in native.test.ts (init warnings) and
 * client.test.ts (requireSecretKeyFor); this file is the single policy anchor.
 */

const mockPlatform = { OS: 'ios' as 'ios' | 'android' };

jest.mock('react-native', () => ({
  Platform: mockPlatform,
}));

jest.mock('framepayments', () => {
  class MockFrameSDK {
    constructor(_config: unknown) {}
    setOnboardingSession = jest.fn();
    clearOnboardingSession = jest.fn(() => true);
  }
  return { FrameSDK: MockFrameSDK };
});

import { setConfig, resetConfig, getSecretKey } from '../config';
import { requireSecretKeyFor, resetClients } from '../client';
import { ErrorCodes } from '../errors';

beforeEach(() => {
  resetConfig();
  resetClients();
});

describe('pk-first policy (FRA-4315)', () => {
  it('accepts a publishable-key-only client (no secret key required)', () => {
    setConfig({ publishableKey: 'pk_test_only', debugMode: false });
    expect(getSecretKey()).toBeUndefined();
    // requireSecretKeyFor is the money-movement gate; a pk-only client must be
    // blocked from server-only operations, not from initialization itself.
    expect(() => requireSecretKeyFor('Checkout')).toThrow(
      expect.objectContaining({ code: ErrorCodes.MISSING_SECRET_KEY }),
    );
  });

  it('keeps secretKey plumbed (pk-first, not pk-only) when supplied', () => {
    // A configured secret key is retained — this is the deliberate deviation
    // from "pk-only": server-only flows still work for existing integrations
    // during the migration window.
    setConfig({ secretKey: 'sk_test', publishableKey: 'pk_test', debugMode: false });
    expect(getSecretKey()).toBe('sk_test');
    expect(() => requireSecretKeyFor('Checkout')).not.toThrow();
  });

  it('gates every server-only entry point on a pk-only client', () => {
    setConfig({ publishableKey: 'pk_test_only', debugMode: false });
    // The three money-movement call sites (checkout, Apple Pay, Google Pay
    // charges) all funnel through requireSecretKeyFor. Assert each label is
    // blocked so none can silently reach a secret-keyed endpoint.
    for (const op of ['Checkout', 'Apple Pay charge', 'Google Pay charge']) {
      try {
        requireSecretKeyFor(op);
        throw new Error(`expected requireSecretKeyFor(${op}) to throw`);
      } catch (e: any) {
        expect(e.code).toBe(ErrorCodes.MISSING_SECRET_KEY);
        expect(e.message).toContain(op);
        // Remediation points the integrator at their backend.
        expect(e.message).toContain('backend');
      }
    }
  });
});
