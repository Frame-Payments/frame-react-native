
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
  currentSessionId,
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
    await storage.set('cs_launch', null);
    const id = await ensureSession('acct_1');
    expect(calls[0]!.method).toBe('PATCH');
    expect(calls[0]!.path).toBe('/v1/charge_sessions/cs_launch');
    expect(calls[0]!.body.account_id).toBe('acct_1');
    expect(await storage.get('acct_1')).toBe(id);
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
    await storage.set('cs_launch', null);
    const [a, b] = await Promise.all([ensureSession('acct_1'), ensureSession('acct_2')]);
    expect(a).not.toBe(b);
    const patches = calls.filter((c) => c.method === 'PATCH' && c.path === '/v1/charge_sessions/cs_launch');
    expect(patches.length).toBeLessThanOrEqual(1);
    expect(await storage.get(null)).toBeNull();
    expect(await storage.get('acct_1')).toBe(a);
    expect(await storage.get('acct_2')).toBe(b);
  });

  it('ensureSession and refreshOnFlowEntry for the same account join one round trip', async () => {
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

describe('currentSessionId', () => {
  it('reads the legacy pre-account slot when accountId is null', async () => {
    await storage.set('sess_legacy', null);
    expect(await currentSessionId(null)).toBe('sess_legacy');
  });

  it('reads the account-scoped slot when accountId is given', async () => {
    await storage.set('sess_acct', 'acct_1');
    expect(await currentSessionId('acct_1')).toBe('sess_acct');
  });

  it('is undefined when nothing is stored — never establishes or adopts one', async () => {
    expect(await currentSessionId(null)).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it('never throws — resolves undefined on a storage read failure', async () => {
    __setSessionStorage({
      ...storage,
      get: async () => {
        throw new Error('storage unavailable');
      },
    });
    await expect(currentSessionId(null)).resolves.toBeUndefined();
  });
});
