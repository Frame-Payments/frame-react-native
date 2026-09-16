import { AppState, type AppStateStatus } from 'react-native';
import { client } from './client';
import { getFingerprintVisitorId } from './fingerprint';
import { recordEvent } from './accountEvents';
import { AccountEventName, AccountEventScreen, AccountEventDetail } from './accountEventCatalog';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

export interface SessionStorage {
  get(accountId: string | null): Promise<string | null>;
  set(value: string, accountId: string | null): Promise<void>;
  clear(accountId: string | null): Promise<void>;
  lastRefresh(accountId: string | null): Promise<number | null>;
  setLastRefresh(at: number, accountId: string | null): Promise<void>;
}

const LEGACY_KEY = 'frame_charge_session_id';
const KEY_PREFIX = 'frame_sonar_session_id_';
const REFRESH_SUFFIX = '_refreshed_at';

function keyFor(accountId: string | null): string {
  return accountId ? KEY_PREFIX + accountId : LEGACY_KEY;
}

interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

let cachedAsyncStorage: AsyncStorageLike | null | undefined;

function loadAsyncStorage(): AsyncStorageLike | null {
  if (cachedAsyncStorage !== undefined) return cachedAsyncStorage;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage') as {
      default?: AsyncStorageLike;
    };
    cachedAsyncStorage = mod.default ?? null;
  } catch {
    cachedAsyncStorage = null;
  }
  return cachedAsyncStorage;
}

export function createDefaultSessionStorage(): SessionStorage {
  const memory = new Map<string, string>();
  const store = loadAsyncStorage();

  const read = async (key: string): Promise<string | null> =>
    store ? await store.getItem(key).catch(() => null) : (memory.get(key) ?? null);
  const write = async (key: string, value: string): Promise<void> => {
    if (store) await store.setItem(key, value).catch(() => {});
    else memory.set(key, value);
  };
  const remove = async (key: string): Promise<void> => {
    if (store) await store.removeItem(key).catch(() => {});
    else memory.delete(key);
  };

  return {
    get: (accountId) => read(keyFor(accountId)),
    set: (value, accountId) => write(keyFor(accountId), value),
    clear: async (accountId) => {
      await remove(keyFor(accountId));
      await remove(keyFor(accountId) + REFRESH_SUFFIX);
    },
    lastRefresh: async (accountId) => {
      const raw = await read(keyFor(accountId) + REFRESH_SUFFIX);
      const parsed = raw === null ? NaN : Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    },
    setLastRefresh: (at, accountId) => write(keyFor(accountId) + REFRESH_SUFFIX, String(at)),
  };
}

let storage: SessionStorage = createDefaultSessionStorage();
let inFlight = new Map<string, Promise<string>>();
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;

let legacySessionLock: Promise<unknown> = Promise.resolve();

function withLegacySessionLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = legacySessionLock.then(fn, fn);
  legacySessionLock = result.catch(() => {});
  return result;
}

let activeAccountId: string | null = null;

export function __setSessionStorage(next: SessionStorage): void {
  storage = next;
}

export function __resetSonarSession(): void {
  storage = createDefaultSessionStorage();
  inFlight = new Map();
  legacySessionLock = Promise.resolve();
  stopKeepAlive();
  activeAccountId = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
}

function sessionIdFrom(response: { id?: string; sonar_session_id?: string }, context: string): string {
  const id = response.sonar_session_id ?? response.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Sonar session ${context} response carried no session id.`);
  }
  return id;
}

async function createSession(accountId: string | null): Promise<string> {
  const visitorId = await getFingerprintVisitorId();
  if (!visitorId) {
    throw new Error('Fingerprint returned no visitor id, so no Sonar session can be created.');
  }
  const response = await client.sdk.chargeSessions.create({
    fingerprint_visitor_id: visitorId,
    ...(accountId ? { account_id: accountId } : {}),
  });
  return sessionIdFrom(response, 'create');
}

async function refreshSession(session: string, accountId: string | null): Promise<string> {
  const visitorId = await getFingerprintVisitorId();
  if (!visitorId) {
    throw new Error('Fingerprint returned no visitor id, so the Sonar session cannot be refreshed.');
  }
  try {
    const response = await client.sdk.chargeSessions.update(session, {
      fingerprint_visitor_id: visitorId,
      ...(accountId ? { account_id: accountId } : {}),
    });
    return sessionIdFrom(response, 'update');
  } catch {
    await storage.clear(accountId);
    const created = await createSession(accountId);
    recordEvent(AccountEventName.FRAUD_SESSION_RECREATED, AccountEventScreen.PAYMENT_SHEET, AccountEventDetail.FRAUD_SESSION_REFRESH_FELL_BACK_TO_RECREATE);
    return created;
  }
}

async function isFresh(accountId: string | null): Promise<boolean> {
  const last = await storage.lastRefresh(accountId);
  return last !== null && Date.now() - last < REFRESH_INTERVAL_MS;
}

async function store(session: string, accountId: string | null): Promise<void> {
  await storage.set(session, accountId);
  await storage.setLastRefresh(Date.now(), accountId);
}

async function establishSession(accountId: string): Promise<string> {
  const existing = await storage.get(accountId);
  if (existing) {
    const refreshed = await refreshSession(existing, accountId);
    await store(refreshed, accountId);
    recordEvent(AccountEventName.FRAUD_SESSION_REFRESHED, AccountEventScreen.PAYMENT_SHEET);
    return refreshed;
  }

  const adopted = await withLegacySessionLock(async () => {
    const stillMissing = await storage.get(accountId);
    if (stillMissing) return stillMissing;

    const legacy = await storage.get(null);
    if (!legacy) return null;

    const value = await refreshSession(legacy, accountId);
    await store(value, accountId);
    await storage.clear(null);
    recordEvent(AccountEventName.FRAUD_SESSION_ADOPTED, AccountEventScreen.PAYMENT_SHEET, AccountEventDetail.FRAUD_SESSION_ADOPTED_FROM_ANONYMOUS);
    return value;
  });
  if (adopted) return adopted;

  const created = await createSession(accountId);
  await store(created, accountId);
  recordEvent(AccountEventName.FRAUD_SESSION_STARTED, AccountEventScreen.PAYMENT_SHEET);
  return created;
}

function startKeepAlive(): void {
  if (keepAliveTimer !== null) return;
  keepAliveTimer = setInterval(() => {
    void touchActiveSession();
  }, KEEP_ALIVE_INTERVAL_MS);
  (keepAliveTimer as unknown as { unref?: () => void }).unref?.();
}

function stopKeepAlive(): void {
  if (keepAliveTimer !== null) clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

async function touchActiveSession(): Promise<void> {
  if (!activeAccountId) {
    await warmUp().catch(() => {});
    return;
  }
  const running = inFlight.get(activeAccountId);
  if (running) {
    await running.catch(() => {});
    return;
  }
  await runExclusive(activeAccountId).catch(() => {});
}

function runExclusive(accountId: string): Promise<string> {
  const running = inFlight.get(accountId);
  if (running) return running;
  const task = establishSession(accountId).finally(() => {
    inFlight.delete(accountId);
  });
  inFlight.set(accountId, task);
  return task;
}

export async function ensureSession(accountId: string): Promise<string> {
  activeAccountId = accountId;
  startKeepAlive();

  const existing = await storage.get(accountId);
  if (existing && (await isFresh(accountId))) return existing;

  return runExclusive(accountId);
}

export async function warmUp(): Promise<void> {
  const stored = await storage.get(null);
  if (stored && (await isFresh(null))) return;

  if (stored) {
    await store(await refreshSession(stored, null), null);
    return;
  }
  await store(await createSession(null), null);
}

export async function initializeSession(accountId?: string | null): Promise<void> {
  const id = accountId && accountId.length > 0 ? accountId : null;
  activeAccountId = id;
  startKeepAlive();

  if (!id) {
    const stored = await storage.get(null);
    if (stored) {
      const refreshed = await refreshSession(stored, null).catch(() => null);
      if (refreshed) await store(refreshed, null);
      return;
    }
    const created = await createSession(null).catch(() => null);
    if (created) await store(created, null);
    return;
  }

  await runExclusive(id).catch(() => {});
}

export async function refreshOnFlowEntry(accountId?: string | null): Promise<void> {
  const id = accountId && accountId.length > 0 ? accountId : null;
  const stored = await storage.get(id).catch(() => null);

  if (!stored) {
    if (id) {
      activeAccountId = id;
      startKeepAlive();
      await runExclusive(id).catch(() => {
        recordEvent(AccountEventName.SONAR_SESSION_FAILED, AccountEventScreen.PAYMENT_SHEET, AccountEventDetail.SONAR_SESSION_FAILED_ON_ENTRY);
      });
      return;
    }
    const created = await createSession(null).catch(() => null);
    if (created) await store(created, null);
    return;
  }

  const refreshed = await refreshSession(stored, id).catch(() => null);
  if (refreshed) await store(refreshed, id);
}

export async function resume(): Promise<void> {
  await touchActiveSession();
  startKeepAlive();
}

export function pause(): void {
  stopKeepAlive();
}

export function observeAppLifecycle(): void {
  if (appStateSubscription) return;
  if (typeof AppState?.addEventListener !== 'function') return;
  appStateSubscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (status === 'active') void resume();
    else if (status === 'background') pause();
  });
}

export async function sessionIdForPayment(accountId: string): Promise<string | undefined> {
  try {
    return await ensureSession(accountId);
  } catch {
    return undefined;
  }
}

export async function currentSessionId(accountId: string | null): Promise<string | undefined> {
  const value = await storage.get(accountId).catch(() => null);
  return value ?? undefined;
}
