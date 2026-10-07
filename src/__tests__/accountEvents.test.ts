let appStateListener: ((status: string) => void) | undefined;
const mockAddEventListener = jest.fn((_event: string, cb: (status: string) => void) => {
  appStateListener = cb;
  return { remove: jest.fn() };
});
jest.mock('react-native', () => ({
  AppState: { addEventListener: (event: string, cb: (status: string) => void) => mockAddEventListener(event, cb) },
  Platform: { OS: 'ios' },
}));

import { setConfig, setAccountIdIfUnset, getAccountId, resetConfig } from '../config';
import { SDK_VERSION } from '../client';
import {
  recordEvent,
  flush,
  observeAccountEventsLifecycle,
  __resetAccountEvents,
  __peekQueue,
  __peekPending,
} from '../accountEvents';

function mockFetchOnce(body: unknown, ok = true, status = ok ? 202 : 500) {
  (global.fetch as jest.Mock).mockImplementationOnce(async () => ({
    ok,
    status,
    json: async () => body,
  }));
}

beforeEach(() => {
  __resetAccountEvents();
  resetConfig();
  appStateListener = undefined;
  mockAddEventListener.mockClear();
  global.fetch = jest.fn();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('recordEvent', () => {
  it('buffers events emitted before an account id exists, then stamps and sends them once one resolves', async () => {
    setConfig({ publishableKey: 'pk_test', debugMode: false });
    recordEvent('onboarding_started', 'Onboarding', 'before account');
    expect(__peekQueue()).toHaveLength(0);
    expect(__peekPending()).toHaveLength(1);
    const occurredAt = __peekPending()[0]!.occurred_at;

    mockFetchOnce({ recorded: 1 });
    setAccountIdIfUnset('acct_created');

    expect(getAccountId()).toBe('acct_created');
    expect(__peekPending()).toHaveLength(0);
    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { events: Array<{ account_id: string; occurred_at: string; detail?: string }> };
    expect(body.events[0]).toMatchObject({
      account_id: 'acct_created',
      occurred_at: occurredAt,
      detail: 'before account',
    });
  });

  it('does not retarget events onto a later account id', () => {
    setConfig({ publishableKey: 'pk_test', debugMode: false, accountId: 'acct_first' });
    setAccountIdIfUnset('acct_second');
    setAccountIdIfUnset('');
    expect(getAccountId()).toBe('acct_first');
  });

  it('drops the oldest buffered event once the pre-account buffer is full', () => {
    setConfig({ publishableKey: 'pk_test', debugMode: false });
    for (let i = 0; i < 210; i++) recordEvent(`event_${i}`, 'Onboarding');
    const buffered = __peekPending();
    expect(buffered).toHaveLength(200);
    expect(buffered[0]!.name).toBe('event_10');
    expect(buffered[buffered.length - 1]!.name).toBe('event_209');
    expect(__peekQueue()).toHaveLength(0);
  });

  it('enqueues an event stamped with platform, sdk_version, and an offset-qualified occurred_at', () => {
    setConfig({ publishableKey: 'pk_test', debugMode: false, accountId: 'acct_1' });
    recordEvent('checkout_transport_failed', 'PaymentSheet', 'network unreachable');

    expect(__peekQueue()).toEqual([
      {
        account_id: 'acct_1',
        name: 'checkout_transport_failed',
        screen: 'PaymentSheet',
        platform: 'react_native',
        sdk_version: SDK_VERSION,
        occurred_at: expect.stringMatching(/Z$/),
        detail: 'network unreachable',
      },
    ]);
    expect(new Date(__peekQueue()[0]!.occurred_at).toISOString()).toBe(__peekQueue()[0]!.occurred_at);
  });

  it('drops the oldest event once the queue is full', () => {
    // Starve the flush by never letting fetch resolve so the cap is what
    // bounds the queue, not the size-threshold auto-flush.
    setConfig({ publishableKey: 'pk_test', debugMode: false, accountId: 'acct_1' });
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    for (let i = 0; i < 225; i++) recordEvent(`event_${i}`, 'PaymentSheet');

    // The size-threshold flush at event 20 drains [0..19] into an in-flight
    // (never-resolving) request; flush() no-ops while one is in flight, so
    // the remaining 205 enqueues (20..224) hit the 200-cap and drop-oldest.
    const queue = __peekQueue();
    expect(queue).toHaveLength(200);
    expect(queue[0]!.name).toBe('event_25');
    expect(queue[queue.length - 1]!.name).toBe('event_224');
  });

  it('flushes once the queue reaches the size threshold', () => {
    setConfig({ publishableKey: 'pk_test', debugMode: false, accountId: 'acct_1' });
    mockFetchOnce({ recorded: 20 });
    for (let i = 0; i < 20; i++) recordEvent(`event_${i}`, 'PaymentSheet');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('flush', () => {
  it('sends a batch to POST /v1/client/account_events with publishable-key auth', async () => {
    setConfig({ publishableKey: 'pk_test_123', debugMode: false, accountId: 'acct_1' });
    recordEvent('device_attestation_failed', 'PaymentSheet');
    mockFetchOnce({ recorded: 1 });

    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.framepayments.com/v1/client/account_events');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer pk_test_123');
    const body = JSON.parse(init.body as string) as { events: unknown[] };
    expect(body.events).toHaveLength(1);
    expect(__peekQueue()).toHaveLength(0);
  });

  it('never sends the secretKey, even if configured', async () => {
    setConfig({
      publishableKey: 'pk_test_123',
      secretKey: 'sk_should_never_be_sent',
      debugMode: false,
      accountId: 'acct_1',
    });
    recordEvent('device_attestation_failed', 'PaymentSheet');
    mockFetchOnce({ recorded: 1 });

    await flush();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer pk_test_123');
    expect(JSON.stringify(init)).not.toContain('sk_should_never_be_sent');
  });

  it('swallows a per-event rejection without retrying it', async () => {
    setConfig({ publishableKey: 'pk_test', debugMode: false, accountId: 'acct_1' });
    recordEvent('checkout_transport_failed', 'PaymentSheet');
    mockFetchOnce({
      recorded: 0,
      rejected: [{ index: 0, name: 'checkout_transport_failed', error: 'account not found' }],
    });

    await expect(flush()).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(__peekQueue()).toHaveLength(0);
  });

  it('retries a transport failure a bounded number of times, then gives up silently', async () => {
    setConfig({ publishableKey: 'pk_test', debugMode: false, accountId: 'acct_1' });
    recordEvent('checkout_transport_failed', 'PaymentSheet');
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(flush()).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('swallows a non-ok response without throwing', async () => {
    setConfig({ publishableKey: 'pk_test', debugMode: false, accountId: 'acct_1' });
    recordEvent('checkout_transport_failed', 'PaymentSheet');
    mockFetchOnce({}, false, 500);

    await expect(flush()).resolves.toBeUndefined();
  });

  it('does nothing when no publishableKey is configured', async () => {
    setConfig({ debugMode: false, accountId: 'acct_1' });
    recordEvent('checkout_transport_failed', 'PaymentSheet');

    await flush();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('app lifecycle', () => {
  it('flushes on background', () => {
    setConfig({ publishableKey: 'pk_test', debugMode: false, accountId: 'acct_1' });
    observeAccountEventsLifecycle();
    mockFetchOnce({ recorded: 1 });
    recordEvent('checkout_transport_failed', 'PaymentSheet');

    appStateListener?.('background');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not attach a second listener on repeated calls', () => {
    observeAccountEventsLifecycle();
    observeAccountEventsLifecycle();
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
  });
});
