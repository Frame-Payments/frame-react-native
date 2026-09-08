/**
 * Unit tests for the Sonar charge-session manager. The storage seam is
 * injected, fingerprint is mocked, and the framepayments SDK's chargeSessions
 * resource is mocked, so nothing touches the network.
 */

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  Platform: { OS: 'ios' },
}));

const mockVisitorId = jest.fn(() => Promise.resolve<string | null>('visitor_1'));
jest.mock('../fingerprint', () => ({
  getFingerprintVisitorId: () => mockVisitorId(),
}));

interface Call {
  method: 'POST' | 'PATCH';
  path: string;
  body: Record<string, unknown>;
}

let calls: Call[] = [];
let nextSessionId = 1;
// Swappable per-test so a single test can simulate a failure-then-success
// sequence (see "replaces a session the server no longer recognises").
let chargeSessionsImpl = {
  create: jest.fn(async (params: Record<string, unknown>) => {
    calls.push({ method: 'POST', path: '/v1/charge_sessions', body: params });
    return { sonar_session_id: `cs_${nextSessionId++}` };
  }),
  update: jest.fn(async (id: string, params: Record<string, unknown>) => {
    calls.push({ method: 'PATCH', path: `/v1/charge_sessions/${id}`, body: params });
    return { sonar_session_id: id };
  }),
};

jest.mock('framepayments', () => {
  class MockFrameSDK {
    get chargeSessions() {
      return chargeSessionsImpl;
    }
    constructor(_config: unknown) {}
  }
  return { FrameSDK: MockFrameSDK };
});

import { setConfig, resetConfig } from '../config';
import { resetClients } from '../client';
import {
  __resetSonarSession,
  __setSessionStorage,
  ensureSession,
  refreshOnFlowEntry,
  warmUp,
  type SessionStorage,
} from '../sonarSession';

function fakeStorage(): SessionStorage {
  const values = new Map<string, string>();
  const refreshes = new Map<string, number>();
  const k = (a: string | null) => a ?? '__pre__';
  return {
    get: async (a) => values.get(k(a)) ?? null,
    set: async (v, a) => void values.set(k(a), v),
    clear: async (a) => {
      values.delete(k(a));
      refreshes.delete(k(a));
    },
    lastRefresh: async (a) => refreshes.get(k(a)) ?? null,
    setLastRefresh: async (at, a) => void refreshes.set(k(a), at),
  };
}

let storage: SessionStorage;

beforeEach(() => {
  __resetSonarSession();
  resetConfig();
  resetClients();
  setConfig({ publishableKey: 'pk_test_x', debugMode: false });
  calls = [];
  nextSessionId = 1;
  mockVisitorId.mockResolvedValue('visitor_1');
  storage = fakeStorage();
  __setSessionStorage(storage);
  chargeSessionsImpl = {
    create: jest.fn(async (params: Record<string, unknown>) => {
      calls.push({ method: 'POST', path: '/v1/charge_sessions', body: params });
      return { sonar_session_id: `cs_${nextSessionId++}` };
    }),
    update: jest.fn(async (id: string, params: Record<string, unknown>) => {
      calls.push({ method: 'PATCH', path: `/v1/charge_sessions/${id}`, body: params });
      return { sonar_session_id: id };
    }),
  };
});

afterEach(() => {
  __resetSonarSession();
  resetConfig();
  resetClients();
});

describe('ensureSession', () => {
  it('creates a session bound to the account', async () => {
    const id = await ensureSession('acct_1');
    expect(id).toBe('cs_1');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.path).toBe('/v1/charge_sessions');
    expect(calls[0]!.body).toEqual({
      fingerprint_visitor_id: 'visitor_1',
      account_id: 'acct_1',
    });
  });

  it('reuses a fresh session without a round trip', async () => {
    await ensureSession('acct_1');
    calls = [];
    const id = await ensureSession('acct_1');
    expect(id).toBe('cs_1');
    expect(calls).toHaveLength(0);
  });

  it('coalesces concurrent callers onto one round trip', async () => {
    const [a, b, c] = await Promise.all([
      ensureSession('acct_1'),
      ensureSession('acct_1'),
      ensureSession('acct_1'),
    ]);
    expect([a, b, c]).toEqual(['cs_1', 'cs_1', 'cs_1']);
    expect(calls).toHaveLength(1);
  });

  it('refreshes a stale session with PATCH, keeping the same account binding', async () => {
    await storage.set('cs_old', 'acct_1');
    await storage.setLastRefresh(Date.now() - 20 * 60 * 1000, 'acct_1');
    await ensureSession('acct_1');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('PATCH');
    expect(calls[0]!.path).toBe('/v1/charge_sessions/cs_old');
    expect(calls[0]!.body.account_id).toBe('acct_1');
  });

  it('adopts the pre-account session rather than orphaning its device event', async () => {
    // The pre-account session accumulated a device event at launch; creating a
    // fresh one here would leave that event on an invisible session.
    await storage.set('cs_launch', null);
    const id = await ensureSession('acct_1');
    expect(calls[0]!.method).toBe('PATCH');
    expect(calls[0]!.path).toBe('/v1/charge_sessions/cs_launch');
    expect(calls[0]!.body.account_id).toBe('acct_1');
    expect(await storage.get('acct_1')).toBe(id);
    // The legacy slot is cleared so the next account can't adopt the same session.
    expect(await storage.get(null)).toBeNull();
  });

  it('keys per account, so a second account does not reuse the first session', async () => {
    await ensureSession('acct_1');
    const second = await ensureSession('acct_2');
    expect(second).not.toBe('cs_1');
    expect(await storage.get('acct_1')).toBe('cs_1');
    expect(await storage.get('acct_2')).toBe(second);
  });

  it('two different accounts racing to adopt the same legacy session do not both claim it', async () => {
    // Regression: establishSession's per-account `inFlight` entry doesn't
    // cover the legacy (pre-account) slot, which is shared across every
    // account. Without a lock, two concurrent first-time ensureSession calls
    // for DIFFERENT accounts could both read, PATCH, and clear the same
    // legacy session — the server does last-write-wins, so one account would
    // end up holding a session id the server actually associated with the
    // other.
    await storage.set('cs_launch', null);
    const [a, b] = await Promise.all([ensureSession('acct_1'), ensureSession('acct_2')]);
    // Exactly one account adopts the legacy session; the other must get its
    // own, distinct session — never the same id.
    expect(a).not.toBe(b);
    const patches = calls.filter((c) => c.method === 'PATCH' && c.path === '/v1/charge_sessions/cs_launch');
    // The legacy session is adopted (PATCHed) at most once.
    expect(patches.length).toBeLessThanOrEqual(1);
    // The legacy slot must not still be readable afterward — leaving it would
    // let a THIRD account also adopt it.
    expect(await storage.get(null)).toBeNull();
    // Both accounts must have their own stored session afterward.
    expect(await storage.get('acct_1')).toBe(a);
    expect(await storage.get('acct_2')).toBe(b);
  });

  it('ensureSession and refreshOnFlowEntry for the same account join one round trip', async () => {
    // Regression: refreshOnFlowEntry used to call establishSession directly
    // rather than through the same inFlight-coalescing path ensureSession
    // uses, so a concurrent pair for the same account (e.g. presentCheckout's
    // refreshOnFlowEntry firing right as checkout's submit calls
    // ensureSession) raced two independent establish calls instead of sharing
    // one.
    const [a, b] = await Promise.all([ensureSession('acct_1'), refreshOnFlowEntry('acct_1')]);
    void b; // refreshOnFlowEntry returns void
    expect(a).toBe('cs_1');
    expect(calls).toHaveLength(1);
  });

  it('replaces a session the server no longer recognises rather than failing', async () => {
    await storage.set('cs_gone', 'acct_1');
    await storage.setLastRefresh(Date.now() - 20 * 60 * 1000, 'acct_1');
    chargeSessionsImpl.update.mockImplementationOnce(async (id: string, params: Record<string, unknown>) => {
      calls.push({ method: 'PATCH', path: `/v1/charge_sessions/${id}`, body: params });
      throw new Error('404 not found');
    });

    expect(await ensureSession('acct_1')).toBe('cs_1');
    expect(calls.map((c) => c.method)).toEqual(['PATCH', 'POST']);
  });

  it('throws when fingerprint yields no visitor id', async () => {
    mockVisitorId.mockResolvedValue(null);
    await expect(ensureSession('acct_1')).rejects.toThrow(/visitor id/);
  });
});

describe('warmUp', () => {
  it('creates a pre-account session with no account_id', async () => {
    await warmUp();
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.body).toEqual({ fingerprint_visitor_id: 'visitor_1' });
    expect(calls[0]!.body.account_id).toBeUndefined();
  });

  it('refreshes a stale pre-account session IN PLACE, preserving the id', async () => {
    // Replacing it would reintroduce the event-landing race that creating early
    // exists to avoid, so the adoption path must still find the same id.
    await storage.set('cs_launch', null);
    await storage.setLastRefresh(Date.now() - 20 * 60 * 1000, null);
    await warmUp();
    expect(calls[0]!.method).toBe('PATCH');
    expect(calls[0]!.path).toBe('/v1/charge_sessions/cs_launch');
  });

  it('does nothing when the pre-account session is still fresh', async () => {
    await storage.set('cs_launch', null);
    await storage.setLastRefresh(Date.now(), null);
    await warmUp();
    expect(calls).toHaveLength(0);
  });
});

describe('refreshOnFlowEntry', () => {
  it('is unconditional — it touches even a fresh session', async () => {
    // Entering a flow is exactly when it is worth a request to be certain the
    // session carries a recent event.
    await ensureSession('acct_1');
    calls = [];
    await refreshOnFlowEntry('acct_1');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('PATCH');
  });

  it('adopts the launch session when the account has none', async () => {
    await storage.set('cs_launch', null);
    await refreshOnFlowEntry('acct_1');
    expect(calls[0]!.path).toBe('/v1/charge_sessions/cs_launch');
    expect(calls[0]!.body.account_id).toBe('acct_1');
  });

  it('swallows failures — it must never block presentation', async () => {
    chargeSessionsImpl.create.mockImplementationOnce(async () => {
      throw new Error('offline');
    });
    await expect(refreshOnFlowEntry('acct_1')).resolves.toBeUndefined();
  });

  it('creates a pre-account session when no account is known', async () => {
    await refreshOnFlowEntry(null);
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.body.account_id).toBeUndefined();
  });
});
