import { AppState, type AppStateStatus } from 'react-native';
import { frameJsonPost, frameRequestHeaders } from './bespokeRequest';
import { FRAME_API_BASE_URL } from './client';
import { getFingerprintVisitorId } from './fingerprint';

// Sonar fraud-detection sessions. Ported from iOS SessionManager
// (`Sources/Frame/Networking/SonarSessionManager.swift`).
//
// The server resolves a payment's session THROUGH the Frame account, so a
// session only backs a payment once it has been associated with one; a session
// created without an account is invisible to risk checks and the payment is
// rejected with `sonar_session_required`. Sessions also go stale: the server
// requires the session's latest device event to be recent, and only a create or
// update call records one.
//
// Naming trap worth stating: iOS's "Sonar session" is the `charge_sessions`
// resource (POST/PATCH /v1/charge_sessions). The framepayments SDK also has a
// `sonarSessions` API on /v1/sonar_sessions — a DIFFERENT resource and the wrong
// target. Neither SDK API accepts fingerprint_visitor_id or account_id, so these
// two calls are hand-rolled through bespokeRequest, which keeps the base URL,
// User-Agent and ip_address header identical to every other SDK request.
//
// All state lives in module scope, not on the SDK instance: prefetchIpAddress
// calls resetClients() mid-flight, which would otherwise discard it.

/** Sits well inside the server's freshness window. */
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/**
 * How often the keep-alive re-touches the live session. Deliberately shorter
 * than REFRESH_INTERVAL_MS so a refresh always lands before the window closes,
 * rather than the window expiring and the refresh falling onto the payment's
 * critical path.
 */
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Where session identifiers are persisted. A seam so tests can inject a fake
 * instead of mocking AsyncStorage. Mirrors iOS's `SessionStorage` protocol.
 */
export interface SessionStorage {
  get(accountId: string | null): Promise<string | null>;
  set(value: string, accountId: string | null): Promise<void>;
  clear(accountId: string | null): Promise<void>;
  lastRefresh(accountId: string | null): Promise<number | null>;
  setLastRefresh(at: number, accountId: string | null): Promise<void>;
}

// Key scheme matches iOS exactly so a session survives a platform switch in a
// shared-storage setup and, more importantly, so the two SDKs agree on what
// "this account's session" means. Keying per account is what stops one
// account's session being reused by the next account on the same device.
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

/**
 * Persists to AsyncStorage when the host has it, matching iOS's UserDefaults
 * (which survives restarts). AsyncStorage is an OPTIONAL peer dep, so this
 * degrades to in-memory when absent — a session is then re-created per app run
 * rather than the SDK failing.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Manager state
// ─────────────────────────────────────────────────────────────────────────────

let storage: SessionStorage = createDefaultSessionStorage();
let inFlight = new Map<string, Promise<string>>();
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;

/**
 * The account whose session the keep-alive should re-touch. `null` means no
 * account is known yet, so the pre-account warm-up session is the live one.
 * This is what stops the keep-alive POSTing a fresh orphan over an adopted
 * session: once an account is known, refreshes go out as an update and preserve
 * the account binding.
 */
let activeAccountId: string | null = null;

/** Test hook — swap the storage seam. */
export function __setSessionStorage(next: SessionStorage): void {
  storage = next;
}

/** Test hook — clear all manager state. */
export function __resetSonarSession(): void {
  storage = createDefaultSessionStorage();
  inFlight = new Map();
  stopKeepAlive();
  activeAccountId = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

interface SessionResponse {
  sonar_session_id?: unknown;
}

async function postSession(path: string, accountId: string | null): Promise<string> {
  const visitorId = await getFingerprintVisitorId();
  if (!visitorId) {
    throw new Error('Fingerprint returned no visitor id, so no Sonar session can be created.');
  }
  const body = {
    fingerprint_visitor_id: visitorId,
    ...(accountId ? { account_id: accountId } : {}),
  };
  const response = await frameJsonPost<SessionResponse>(path, body, 'Sonar session');
  const id = response.sonar_session_id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Sonar session response carried no sonar_session_id.');
  }
  return id;
}

async function createSession(accountId: string | null): Promise<string> {
  return postSession('/v1/charge_sessions', accountId);
}

/**
 * Updates an existing session, associating it with `accountId` and recording a
 * new device event server-side — the latter is what returns the session to the
 * freshness window. A null `accountId` refreshes the pre-account session in
 * place, keeping the same id so the device event accumulates against it rather
 * than against a fresh orphan.
 *
 * PATCH, not POST — frameJsonPost is POST-only, so this issues the request
 * directly with the same shared headers.
 */
async function refreshSession(session: string, accountId: string | null): Promise<string> {
  const visitorId = await getFingerprintVisitorId();
  if (!visitorId) {
    throw new Error('Fingerprint returned no visitor id, so the Sonar session cannot be refreshed.');
  }
  const body = {
    fingerprint_visitor_id: visitorId,
    ...(accountId ? { account_id: accountId } : {}),
  };
  try {
    const response = await fetch(
      `${FRAME_API_BASE_URL}/v1/charge_sessions/${encodeURIComponent(session)}`,
      { method: 'PATCH', headers: frameRequestHeaders(), body: JSON.stringify(body) },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = (await response.json()) as SessionResponse;
    const id = parsed.sonar_session_id;
    if (typeof id !== 'string' || id.length === 0) throw new Error('no sonar_session_id');
    return id;
  } catch {
    // The server no longer recognises this session, so replace it rather than
    // fail the payment.
    await storage.clear(accountId);
    return createSession(accountId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

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
    return refreshed;
  }

  const legacy = await storage.get(null);
  if (legacy) {
    // Adopt the pre-account session rather than creating a fresh one, so its id
    // and accumulated device event survive.
    const adopted = await refreshSession(legacy, accountId);
    await store(adopted, accountId);
    // Leaving the legacy slot readable would let the next account on this
    // device adopt the same session.
    await storage.clear(null);
    return adopted;
  }

  const created = await createSession(accountId);
  await store(created, accountId);
  return created;
}

/**
 * Starts the periodic refresh of whichever session is currently live.
 *
 * Idempotent by design: this is called from every ensureSession, and
 * cancel-and-recreate would restart the interval, so a user retrying checkout
 * could push the next refresh out indefinitely. The tick reads activeAccountId
 * when it fires, so an already-running timer picks up a newly adopted account
 * without a restart.
 */
function startKeepAlive(): void {
  if (keepAliveTimer !== null) return;
  keepAliveTimer = setInterval(() => {
    void touchActiveSession();
  }, KEEP_ALIVE_INTERVAL_MS);
  // A background refresh is not a reason to hold a process open. RN's timers
  // have no unref, so this is a no-op there and only matters under Node (tests,
  // SSR-style harnesses), where an un-unref'd interval hangs the run.
  (keepAliveTimer as unknown as { unref?: () => void }).unref?.();
}

function stopKeepAlive(): void {
  if (keepAliveTimer !== null) clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

/**
 * Refreshes the live session: the adopted account session when one is known,
 * otherwise the pre-account warm-up session. Failures are swallowed
 * deliberately — this runs in the background, and a missed keep-alive is
 * recovered by ensureSession on the payment path.
 */
async function touchActiveSession(): Promise<void> {
  if (!activeAccountId) {
    await warmUp().catch(() => {});
    return;
  }
  // Join an in-flight establish rather than issuing a competing one — a
  // keep-alive tick can land while checkout is already establishing the same
  // session.
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

// ─────────────────────────────────────────────────────────────────────────────
// Public surface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a session for `accountId` fresh enough to back a payment, creating or
 * refreshing one if necessary. Idempotent, and coalesces concurrent callers
 * onto a single round trip.
 *
 * Call this before taking a payment and await it: the server rejects a transfer
 * outright without a live session for the account.
 */
export async function ensureSession(accountId: string): Promise<string> {
  // From here on the keep-alive refreshes this account's session rather than
  // the pre-account one.
  activeAccountId = accountId;
  startKeepAlive();

  const existing = await storage.get(accountId);
  if (existing && (await isFresh(accountId))) return existing;

  return runExclusive(accountId);
}

/**
 * Brings the pre-account session into the freshness window, creating one only
 * when none exists. Freshness-gated, so this is the keep-alive's tick for the
 * pre-account session.
 *
 * A stale session is refreshed IN PLACE, keeping the same id so the new device
 * event accumulates against the session the adoption path will look for.
 * Replacing it here would reintroduce the event-landing race that creating
 * early exists to avoid.
 */
export async function warmUp(): Promise<void> {
  const stored = await storage.get(null);
  if (stored && (await isFresh(null))) return;

  if (stored) {
    await store(await refreshSession(stored, null), null);
    return;
  }
  await store(await createSession(null), null);
}

/**
 * Establishes the session this app run uses, at SDK start-up. The server
 * fetches a new session's device event asynchronously, so starting early gives
 * that event time to land before checkout.
 *
 * Unconditional rather than freshness-gated: the stored session outlives the
 * process, so a launch inside the window would otherwise record nothing.
 * Failures are swallowed; the payment path calls ensureSession.
 */
export async function initializeSession(accountId?: string | null): Promise<void> {
  const id = accountId && accountId.length > 0 ? accountId : null;
  activeAccountId = id;
  startKeepAlive();

  if (!id) {
    const stored = await storage.get(null);
    if (stored) {
      // Refresh in place when one exists, so the id the adoption path will look
      // for survives.
      const refreshed = await refreshSession(stored, null).catch(() => null);
      if (refreshed) await store(refreshed, null);
      return;
    }
    const created = await createSession(null).catch(() => null);
    if (created) await store(created, null);
    return;
  }

  await establishSession(id).catch(() => {});
}

/**
 * Records a device event when the merchant presents one of the SDK's entry-point
 * screens — onboarding, checkout, cart, or a standalone payment element.
 *
 * Mirrors the web SDK, which writes the session once per page load. A native app
 * has no page loads, so presenting one of these screens is the closest
 * equivalent: it is the point where the user has committed to a flow that risk
 * checks will score.
 *
 * Deliberately unconditional rather than freshness-gated — the window is an
 * SDK-side estimate of the server's, and entering a flow is exactly when it is
 * worth a request to be certain. Fire-and-forget; failures are ignored.
 */
export async function refreshOnFlowEntry(accountId?: string | null): Promise<void> {
  const id = accountId && accountId.length > 0 ? accountId : null;
  const stored = await storage.get(id).catch(() => null);

  if (!stored) {
    if (id) {
      // Route through establishSession so the launch session is ADOPTED onto
      // the account, keeping its id and accumulated device event. Creating a
      // fresh one here would orphan that event on an invisible session.
      activeAccountId = id;
      startKeepAlive();
      await establishSession(id).catch(() => {});
      return;
    }
    const created = await createSession(null).catch(() => null);
    if (created) await store(created, null);
    return;
  }

  const refreshed = await refreshSession(stored, id).catch(() => null);
  if (refreshed) await store(refreshed, id);
}

/**
 * Re-touches the live session and restarts the keep-alive after the app returns
 * to the foreground. Backgrounding is the most common way a session goes stale
 * — timers do not fire while suspended, so the window can close unnoticed.
 */
export async function resume(): Promise<void> {
  await touchActiveSession();
  startKeepAlive();
}

/** Stops the keep-alive while backgrounded, so it neither burns cycles nor fires requests that would be suspended mid-flight. */
export function pause(): void {
  stopKeepAlive();
}

/**
 * Registers the AppState listener that drives resume/pause. Called once from
 * Frame.initialize, where iOS registers its own observer. Idempotent.
 */
export function observeAppLifecycle(): void {
  if (appStateSubscription) return;
  // Guarded: AppState is absent under some test renderers and older RN shims,
  // and losing the keep-alive is not a reason to fail Frame.initialize.
  if (typeof AppState?.addEventListener !== 'function') return;
  appStateSubscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (status === 'active') void resume();
    else if (status === 'background') pause();
  });
}

/**
 * The stored session id for a payment, or undefined when none is available.
 * Never throws: a missing session must not block a payment from being attempted,
 * since the server's rejection is the authoritative answer.
 */
export async function sessionIdForPayment(accountId: string): Promise<string | undefined> {
  try {
    return await ensureSession(accountId);
  } catch {
    return undefined;
  }
}
