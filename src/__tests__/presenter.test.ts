// The presenter module itself doesn't need any RN APIs, but its sibling
// FramePresentationHost imports Toast which calls `StyleSheet.create(...)` at
// module-load. Provide just enough surface that those loads don't crash.
jest.mock('react-native', () => ({
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1, absoluteFillObject: {} },
  Platform: { OS: 'ios', select: (m: Record<string, unknown>) => m.ios },
  View: 'View',
  Text: 'Text',
  Animated: { View: 'Animated.View', timing: () => ({ start: () => {} }), Value: class { constructor() {} } },
  Easing: { out: () => () => 0, ease: () => 0 },
  PanResponder: { create: () => ({ panHandlers: {} }) },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  Modal: 'Modal',
}));

import {
  presentScreen,
  setHostMounted,
  isHostMounted,
  subscribe,
  requestActiveCancel,
  __resetPresenter,
} from '../presenter';
import type { FramePresentationApi } from '../presenter';

beforeEach(() => {
  __resetPresenter();
});

describe('presenter — host lifecycle', () => {
  it('isHostMounted is false initially', () => {
    expect(isHostMounted()).toBe(false);
  });

  it('setHostMounted(true) flips the flag', () => {
    setHostMounted(true);
    expect(isHostMounted()).toBe(true);
  });
});

describe('presenter — presentScreen guards', () => {
  it('rejects NO_PROVIDER when the host is not mounted', async () => {
    await expect(presentScreen(() => ({} as never))).rejects.toMatchObject({
      code: 'NO_PROVIDER',
    });
  });

  it('rejects PRESENTER_BUSY when a screen is already active', async () => {
    setHostMounted(true);
    let captured: FramePresentationApi<string> | null = null;
    const first = presentScreen<string>((api) => {
      captured = api;
      return {} as never;
    });

    await expect(
      presentScreen<string>(() => ({} as never)),
    ).rejects.toMatchObject({ code: 'PRESENTER_BUSY' });

    // Settle the first call so the test cleanup is well-defined.
    captured!.complete('done');
    await expect(first).resolves.toBe('done');
  });
});

describe('presenter — happy paths', () => {
  beforeEach(() => {
    setHostMounted(true);
  });

  it('resolves with the value from complete()', async () => {
    let captured: FramePresentationApi<string> | null = null;
    const p = presentScreen<string>((api) => {
      captured = api;
      return {} as never;
    });
    captured!.complete('charge_id_1');
    await expect(p).resolves.toBe('charge_id_1');
  });

  it('rejects USER_CANCELED from cancel()', async () => {
    let captured: FramePresentationApi<unknown> | null = null;
    const p = presentScreen((api) => {
      captured = api;
      return {} as never;
    });
    captured!.cancel();
    await expect(p).rejects.toMatchObject({ code: 'USER_CANCELED' });
  });

  it('rejects with the thrown error from fail()', async () => {
    const err = Object.assign(new Error('payment broke'), { code: 'PAYMENT_FAILED' });
    let captured: FramePresentationApi<unknown> | null = null;
    const p = presentScreen((api) => {
      captured = api;
      return {} as never;
    });
    captured!.fail(err);
    await expect(p).rejects.toMatchObject({ code: 'PAYMENT_FAILED', message: 'payment broke' });
  });
});

describe('presenter — settle idempotency', () => {
  it('ignores a second settle call from the same screen (cancel after complete is a no-op)', async () => {
    setHostMounted(true);
    let captured: FramePresentationApi<string> | null = null;
    const p = presentScreen<string>((api) => {
      captured = api;
      return {} as never;
    });
    captured!.complete('first');
    captured!.cancel(); // ignored — promise already resolved
    captured!.fail(new Error('nope')); // ignored too
    await expect(p).resolves.toBe('first');
  });

  it('allows a new presentScreen after the previous one settled', async () => {
    setHostMounted(true);
    let firstApi: FramePresentationApi<string> | null = null;
    const first = presentScreen<string>((api) => {
      firstApi = api;
      return {} as never;
    });
    firstApi!.complete('a');
    await expect(first).resolves.toBe('a');

    let secondApi: FramePresentationApi<string> | null = null;
    const second = presentScreen<string>((api) => {
      secondApi = api;
      return {} as never;
    });
    secondApi!.complete('b');
    await expect(second).resolves.toBe('b');
  });
});

describe('presenter — subscribe', () => {
  beforeEach(() => {
    setHostMounted(true);
  });

  it('notifies the subscriber on present, then on settle', async () => {
    const events: Array<unknown> = [];
    const unsubscribe = subscribe((active) => events.push(active));

    let captured: FramePresentationApi<string> | null = null;
    const p = presentScreen<string>((api) => {
      captured = api;
      return { type: 'TestScreen' } as never;
    });

    captured!.complete('x');
    await p;

    // Initial null (sync subscribe replay) + active presentation + null after settle.
    expect(events.length).toBe(3);
    expect(events[0]).toBeNull();
    expect(events[1]).toMatchObject({ id: expect.any(Number), element: { type: 'TestScreen' } });
    expect(events[2]).toBeNull();
    unsubscribe();
  });

  it('unsubscribe stops notifications', async () => {
    const events: Array<unknown> = [];
    const unsubscribe = subscribe((active) => events.push(active));
    unsubscribe();

    let captured: FramePresentationApi<string> | null = null;
    const p = presentScreen<string>((api) => {
      captured = api;
      return {} as never;
    });
    captured!.complete('done');
    await p;

    // Only the initial replay was delivered before unsubscribe.
    expect(events.length).toBe(1);
    expect(events[0]).toBeNull();
  });
});

describe('presenter — host unmount mid-flight', () => {
  it('rejects the in-flight promise with PRESENTER_TEARDOWN when the host unmounts', async () => {
    setHostMounted(true);
    const p = presentScreen(() => ({} as never));
    setHostMounted(false);
    await expect(p).rejects.toMatchObject({ code: 'PRESENTER_TEARDOWN' });
  });

  it('recovers after unmount + remount; new presentScreen works', async () => {
    setHostMounted(true);
    const first = presentScreen(() => ({} as never));
    setHostMounted(false);
    await expect(first).rejects.toMatchObject({ code: 'PRESENTER_TEARDOWN' });

    setHostMounted(true);
    let captured: FramePresentationApi<string> | null = null;
    const second = presentScreen<string>((api) => {
      captured = api;
      return {} as never;
    });
    captured!.complete('recovered');
    await expect(second).resolves.toBe('recovered');
  });
});

describe('presenter — requestActiveCancel (host-driven cancel)', () => {
  beforeEach(() => {
    setHostMounted(true);
  });

  it('rejects USER_CANCELED when the host calls requestActiveCancel', async () => {
    const p = presentScreen(() => ({} as never));
    requestActiveCancel();
    await expect(p).rejects.toMatchObject({ code: 'USER_CANCELED' });
  });

  it('is a no-op when nothing is presented', () => {
    expect(() => requestActiveCancel()).not.toThrow();
  });

  it('does not re-trigger after the screen has already settled', async () => {
    let captured: FramePresentationApi<string> | null = null;
    const p = presentScreen<string>((api) => {
      captured = api;
      return {} as never;
    });
    captured!.complete('ok');
    requestActiveCancel(); // host fires after settle — must be a no-op
    await expect(p).resolves.toBe('ok');
  });
});

describe('presenter — concurrent presentScreen with fast settle', () => {
  it('rejects the second call with PRESENTER_BUSY even if the first settles synchronously', async () => {
    setHostMounted(true);
    let firstApi: FramePresentationApi<string> | null = null;
    const first = presentScreen<string>((api) => {
      firstApi = api;
      return {} as never;
    });

    // Second call lands BEFORE the first settles — must reject BUSY.
    const second = presentScreen<string>(() => ({} as never));

    // Settle the first synchronously; second was already rejected.
    firstApi!.complete('first');

    await expect(second).rejects.toMatchObject({ code: 'PRESENTER_BUSY' });
    await expect(first).resolves.toBe('first');
  });
});
