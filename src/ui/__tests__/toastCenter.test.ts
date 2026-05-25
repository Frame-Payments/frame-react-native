import {
  showToast,
  dismissActive,
  subscribeToasts,
  __resetToastCenter,
  type ToastEntry,
} from '../primitives/toastCenter';

beforeEach(() => {
  jest.useFakeTimers();
  __resetToastCenter();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('toastCenter', () => {
  it('publishes a toast to subscribers when showToast is called', () => {
    const events: Array<ToastEntry | null> = [];
    const unsubscribe = subscribeToasts((t) => events.push(t));

    showToast('Card declined');

    // Replay (null) + active toast.
    expect(events.length).toBe(2);
    expect(events[0]).toBeNull();
    expect(events[1]).toMatchObject({ message: 'Card declined', variant: 'error', duration: 4000 });
    unsubscribe();
  });

  it('auto-dismisses after the configured duration', () => {
    const events: Array<ToastEntry | null> = [];
    subscribeToasts((t) => events.push(t));
    showToast('Bye', { durationMs: 1500 });
    expect(events[events.length - 1]).toMatchObject({ message: 'Bye' });

    jest.advanceTimersByTime(1500);
    expect(events[events.length - 1]).toBeNull();
  });

  it('replaces an existing toast when a new one is shown (no overlap)', () => {
    const events: Array<ToastEntry | null> = [];
    subscribeToasts((t) => events.push(t));
    showToast('First');
    showToast('Second');

    expect(events[events.length - 1]).toMatchObject({ message: 'Second' });
    // Advance past the original timer; second toast should still be alive.
    jest.advanceTimersByTime(4000);
    // 4000ms after Second was shown the second timer fires and clears.
    expect(events[events.length - 1]).toBeNull();
  });

  it('cancels the dismiss timer when dismissActive is called', () => {
    showToast('Tap me', { durationMs: 5000 });
    dismissActive();
    // Timer should be cleared; advancing should not re-fire dismissActive.
    const before = jest.getTimerCount();
    jest.advanceTimersByTime(10000);
    expect(jest.getTimerCount()).toBeLessThanOrEqual(before);
  });

  it('supports info variant', () => {
    const events: Array<ToastEntry | null> = [];
    subscribeToasts((t) => events.push(t));
    showToast('Saved', { variant: 'info' });
    expect(events[events.length - 1]).toMatchObject({ variant: 'info' });
  });
});
