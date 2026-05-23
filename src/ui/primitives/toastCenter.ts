// Singleton toast center. Screens / view models call `showToast(message)` and
// the <ToastHost /> mounted by FrameProvider picks the new toast up via
// subscribe(). Mirrors iOS ToastCenter / Android ToastHost in the native
// Frame SDKs — same 4s auto-dismiss + tap-to-dismiss + spring animation.

export interface ToastEntry {
  id: number;
  message: string;
  variant: 'error' | 'info';
  /** ms; defaults to 4000. */
  duration: number;
}

type Listener = (toast: ToastEntry | null) => void;

const DEFAULT_DURATION_MS = 4000;
let nextId = 1;
let active: ToastEntry | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(active);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(active);
  return () => {
    listeners.delete(listener);
  };
}

export interface ShowToastOptions {
  variant?: 'error' | 'info';
  durationMs?: number;
}

export function showToast(message: string, opts: ShowToastOptions = {}): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  active = {
    id: nextId++,
    message,
    variant: opts.variant ?? 'error',
    duration: opts.durationMs ?? DEFAULT_DURATION_MS,
  };
  emit();
  dismissTimer = setTimeout(() => {
    dismissActive();
  }, active.duration);
}

export function dismissActive(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  if (active) {
    active = null;
    emit();
  }
}

export function __resetToastCenter(): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = null;
  active = null;
  nextId = 1;
  listeners.clear();
}
