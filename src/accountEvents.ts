import { AppState, type AppStateStatus } from 'react-native';
import { getAccountId, getPublishableKey } from './config';
import { FRAME_API_BASE_URL, SDK_VERSION, SDK_VERSION_HEADER, frameUserAgent } from './client';
import type { AccountEventName, AccountEventScreen } from './accountEventCatalog';

const MAX_QUEUE_SIZE = 100;
const MAX_BATCH_SIZE = 100;
const FLUSH_SIZE_THRESHOLD = 20;
const FLUSH_INTERVAL_MS = 20_000;
const MAX_TRANSPORT_RETRIES = 2;

interface AccountEvent {
  account_id: string;
  name: string;
  screen: string;
  platform: 'react_native';
  sdk_version: string;
  occurred_at: string;
  detail?: string;
}

interface AccountEventsResponse {
  recorded: number;
  rejected?: { index: number; name: string; error: string }[];
}

let queue: AccountEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let flushing: Promise<void> | null = null;

/**
 * `name` and `screen` are typed as {@link AccountEventName}/{@link AccountEventScreen}
 * union members for the common case, but widened to `string` to admit the few call sites
 * that legitimately compute one dynamically (a per-step key, or an idv-category-derived
 * event name) rather than picking a fixed catalog value.
 */
export function recordEvent(name: AccountEventName | (string & {}), screen: AccountEventScreen | (string & {}), detail?: string): void {
  const accountId = getAccountId();
  if (!accountId) return;

  // Drop-oldest: telemetry must never block or grow unbounded against a
  // payment flow, so a full queue silently loses its oldest entry.
  if (queue.length >= MAX_QUEUE_SIZE) queue.shift();
  queue.push({
    account_id: accountId,
    name,
    screen,
    platform: 'react_native',
    sdk_version: SDK_VERSION,
    occurred_at: new Date().toISOString(),
    detail,
  });

  startFlushTimer();
  if (queue.length >= FLUSH_SIZE_THRESHOLD) void flush();
}

function startFlushTimer(): void {
  if (flushTimer !== null) return;
  flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  (flushTimer as unknown as { unref?: () => void }).unref?.();
}

function stopFlushTimer(): void {
  if (flushTimer !== null) clearInterval(flushTimer);
  flushTimer = null;
}

export function observeAccountEventsLifecycle(): void {
  if (appStateSubscription) return;
  if (typeof AppState?.addEventListener !== 'function') return;
  appStateSubscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (status === 'background') void flush();
  });
}

async function sendBatch(events: AccountEvent[], attempt: number): Promise<void> {
  const publishableKey = getPublishableKey();
  if (!publishableKey) return;

  const userAgent = frameUserAgent();
  let response: Response;
  try {
    response = await fetch(`${FRAME_API_BASE_URL}/v1/client/account_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publishableKey}`,
        [SDK_VERSION_HEADER]: SDK_VERSION,
        ...(userAgent ? { 'User-Agent': userAgent } : {}),
      },
      body: JSON.stringify({ events }),
    });
  } catch {
    // Transport failure: bounded retry, no tight loop.
    if (attempt < MAX_TRANSPORT_RETRIES) await sendBatch(events, attempt + 1);
    return;
  }

  if (!response.ok) return;

  try {
    (await response.json()) as AccountEventsResponse;
  } catch {
    // Malformed response body; the batch was still accepted (202), nothing to retry.
  }
}

export function flush(): Promise<void> {
  if (flushing) return flushing;
  if (queue.length === 0) {
    stopFlushTimer();
    return Promise.resolve();
  }

  const batch = queue.splice(0, MAX_BATCH_SIZE);
  flushing = sendBatch(batch, 0)
    .catch(() => {})
    .finally(() => {
      flushing = null;
      if (queue.length === 0) stopFlushTimer();
    });
  return flushing;
}

export function __resetAccountEvents(): void {
  queue = [];
  stopFlushTimer();
  flushing = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
}

export function __peekQueue(): readonly AccountEvent[] {
  return queue;
}
