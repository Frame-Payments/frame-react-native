// Single one-time warning helper shared across the SDK. Misconfiguration
// warnings (e.g. a secret key shipped on device, a malformed onboarding-session
// token) fire ONCE per process regardless of debugMode — they signal a wiring
// mistake the integrator must fix, so suppressing them in production would hide
// the very problem they exist to surface. (Verbose per-request debug logging is
// separate: see `debugWarn` in native.tsx, which is debugMode-gated.)

const warned = new Set<string>();

export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[Frame] ${message}`);
}

// Test hook so the one-time guard doesn't leak across cases.
export function __resetWarnOnceForTests(): void {
  warned.clear();
}
