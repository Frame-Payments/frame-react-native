import type { ReactElement } from 'react';
import { frameError, ErrorCodes } from '../errors';

// Singleton presenter that bridges the imperative `Frame.presentCheckout` /
// `Frame.presentCart` API to the declarative React host mounted by
// FrameProvider. The host subscribes via `subscribe`; JS callers push screens
// in via `present`. Exactly one screen can be presented at a time — concurrent
// calls reject with PRESENTER_BUSY rather than racing.

export type FramePresentResult<T> =
  | { kind: 'success'; value: T }
  | { kind: 'cancel' }
  | { kind: 'failure'; error: unknown };

export interface FramePresentationApi<T> {
  /** Resolve the pending presentScreen promise with the success value. */
  complete: (value: T) => void;
  /** Reject the pending presentScreen promise with USER_CANCELED. */
  cancel: () => void;
  /** Reject the pending presentScreen promise with the given error. */
  fail: (error: unknown) => void;
}

export interface ActivePresentation {
  id: number;
  element: ReactElement;
}

type Listener = (active: ActivePresentation | null) => void;

let nextId = 1;
let active: ActivePresentation | null = null;
// Captured from the in-flight presentScreen so setHostMounted(false) can reject
// the awaiting caller. Settle paths use the closure-bound reject directly.
let pendingReject: ((reason: unknown) => void) | null = null;
// Triggered by the host when the user dismisses via the OS gesture (Android
// hardware back, iOS pageSheet swipe-down). Resolves to USER_CANCELED on the
// JS side just like the screen calling `api.cancel()` itself.
let cancelActive: (() => void) | null = null;
let hostMounted = false;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(active);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(active);
  return () => {
    listeners.delete(listener);
  };
}

export function setHostMounted(mounted: boolean): void {
  const wasMounted = hostMounted;
  hostMounted = mounted;
  if (!mounted && pendingReject) {
    // The provider unmounted while a presentation was in flight. Reject the
    // caller, then notify host subscribers so the new state is consistent.
    const reject = pendingReject;
    pendingReject = null;
    cancelActive = null;
    active = null;
    reject(frameError('PRESENTER_TEARDOWN', 'FrameProvider unmounted while a screen was presented.'));
    emit();
  }
  // Remount after a previous unmount: clear any stale active state from a
  // screen the host stopped rendering before it could settle. Listeners stay
  // attached so the freshly mounted host picks up the now-empty state.
  if (mounted && !wasMounted) {
    active = null;
    pendingReject = null;
    cancelActive = null;
  }
}

export function isHostMounted(): boolean {
  return hostMounted;
}

/**
 * Imperatively present a screen and await its result. The `render` callback
 * receives the presentation API (complete/cancel/fail) and must return the
 * React element to mount. Returns the value the screen passed to complete().
 *
 * Rejects with NO_PROVIDER if `FrameProvider` is not mounted at the time of
 * the call. Rejects with PRESENTER_BUSY if another screen is already active.
 */
export function presentScreen<T>(
  render: (api: FramePresentationApi<T>) => ReactElement,
): Promise<T> {
  if (!hostMounted) {
    return Promise.reject(
      frameError(
        'NO_PROVIDER',
        'FrameProvider must be mounted at the app root before calling Frame.presentCheckout / presentCart / presentOnboarding.',
      ),
    );
  }
  if (active) {
    return Promise.reject(
      frameError('PRESENTER_BUSY', 'Another Frame screen is already presented.'),
    );
  }

  return new Promise<T>((resolve, reject) => {
    const id = nextId++;
    const api: FramePresentationApi<T> = {
      complete: (value) => settle({ kind: 'success', value }),
      cancel: () => settle({ kind: 'cancel' }),
      fail: (error) => settle({ kind: 'failure', error }),
    };

    function settle(result: FramePresentResult<T>): void {
      if (!active || active.id !== id) return;
      active = null;
      pendingReject = null;
      cancelActive = null;
      emit();
      switch (result.kind) {
        case 'success':
          resolve(result.value);
          return;
        case 'cancel':
          reject(frameError(ErrorCodes.USER_CANCELED, 'User dismissed the Frame screen without completing.'));
          return;
        case 'failure':
          reject(result.error);
          return;
      }
    }

    pendingReject = reject;
    cancelActive = () => api.cancel();
    active = { id, element: render(api) };
    emit();
  });
}

/**
 * Triggered by the host when the user dismisses via OS gesture (Android back,
 * iOS swipe-down). Equivalent to the screen calling `api.cancel()` itself.
 * No-op if nothing is active.
 */
export function requestActiveCancel(): void {
  cancelActive?.();
}

// Test-only resets. Not exported from src/index.
export function __resetPresenter(): void {
  active = null;
  pendingReject = null;
  cancelActive = null;
  hostMounted = false;
  listeners.clear();
  nextId = 1;
}
