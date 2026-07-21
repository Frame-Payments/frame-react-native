import { ErrorCodes, frameError } from './errors';

// Thin wrapper around react-native-persona so the rest of the SDK doesn't have
// to deal with the dynamic import / peer-dep dance. Mirrors src/plaid.ts: a
// guarded `isPersonaAvailable()` plus a single `launchPersonaInquiry({ inquiryId })`
// entry point that owns the builder → start round-trip and resolves with the
// inquiry outcome.
//
// The Persona SDK is an OPTIONAL peer dep. Host apps that don't offer the
// no-SSN government-ID path don't need it. We lazy-require it so a missing dep
// doesn't crash module load — `isPersonaAvailable()` returns false and the
// onboarding screen hides the "I don't have a social security number" button.

// Minimal structural view of the react-native-persona surface we consume.
// Kept local (rather than importing the package's types) so this module still
// type-checks when the optional peer dep isn't installed. Verified against
// react-native-persona@2.47.0:
//   Inquiry.fromInquiry(inquiryId) → InquiryBuilder
//     .onComplete((inquiryId, status, fields, extraData) => void)
//     .onCanceled((inquiryId?, sessionToken?) => void)
//     .onError((error, errorCode?) => void)
//     .build() → Inquiry
//   Inquiry.start(): void   // launches the native modal; NOT a promise
type PersonaFields = Record<string, unknown>;

interface PersonaInquiryInstance {
  start(): void;
}

interface PersonaInquiryBuilder {
  onComplete(
    cb: (inquiryId: string, status: string, fields: PersonaFields, extraData?: unknown) => void,
  ): PersonaInquiryBuilder;
  onCanceled(cb: (inquiryId?: string, sessionToken?: string) => void): PersonaInquiryBuilder;
  onError(cb: (error: Error, errorCode?: string) => void): PersonaInquiryBuilder;
  build(): PersonaInquiryInstance;
}

interface PersonaSdk {
  Inquiry: {
    fromInquiry(inquiryId: string): PersonaInquiryBuilder;
  };
}

let cachedSdk: PersonaSdk | null | undefined;

function loadSdk(): PersonaSdk | null {
  if (cachedSdk !== undefined) return cachedSdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-persona');
    // The package exports `Inquiry` as a named export; some bundlers surface
    // named exports off `default`. Accept either so we work under both CJS and
    // ESM interop.
    const inquiry = (mod as { Inquiry?: unknown }).Inquiry
      ?? (mod as { default?: { Inquiry?: unknown } }).default?.Inquiry;
    if (!inquiry) {
      cachedSdk = null;
    } else {
      cachedSdk = { Inquiry: inquiry } as PersonaSdk;
    }
  } catch {
    cachedSdk = null;
  }
  return cachedSdk;
}

/** True when react-native-persona resolves in the host app. Gates the no-SSN
 *  government-ID button so it never renders in apps without the dep. */
export function isPersonaAvailable(): boolean {
  return loadSdk() !== null;
}

export interface PersonaInquiryResult {
  inquiryId: string;
  /** Persona's client-side terminal status (e.g. 'completed', 'failed'). Best-
   *  effort only — see the caveat below. */
  status: string;
  /** Fields returned by Persona on completion. Opaque to us; not persisted. */
  fields: PersonaFields;
}

/**
 * Launch the Persona mobile flow against a PRE-CREATED inquiry id
 * (`Inquiry.fromInquiry(inquiryId)`), NOT a template. Resolves on the SDK's
 * `onComplete`, rejects with USER_CANCELED on cancel, PAYMENT_FAILED on error,
 * or PERSONA_UNAVAILABLE when the SDK isn't installed.
 *
 * ⚠️ The resolved `status` is Persona's client-side, best-effort signal — it is
 * NOT authoritative. Callers MUST confirm verification via the Frame backend
 * (`POST /idv/complete`) before flipping any UI to a verified state. This
 * promise resolving only means the user finished the flow on-device.
 */
export function launchPersonaInquiry(opts: { inquiryId: string }): Promise<PersonaInquiryResult> {
  const sdk = loadSdk();
  if (!sdk) {
    return Promise.reject(
      frameError(
        ErrorCodes.PERSONA_UNAVAILABLE,
        'Persona is not installed in this app. Add react-native-persona to your peer deps and rebuild.',
      ),
    );
  }

  return new Promise<PersonaInquiryResult>((resolve, reject) => {
    let settled = false;
    const settleResolve = (value: PersonaInquiryResult) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const settleReject = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    try {
      sdk.Inquiry.fromInquiry(opts.inquiryId)
        .onComplete((inquiryId, status, fields) => {
          settleResolve({ inquiryId: inquiryId ?? opts.inquiryId, status, fields: fields ?? {} });
        })
        .onCanceled(() => {
          settleReject(frameError(ErrorCodes.USER_CANCELED, 'User canceled identity verification.'));
        })
        .onError((error) => {
          settleReject(
            frameError(ErrorCodes.PAYMENT_FAILED, error?.message ?? 'Identity verification failed.'),
          );
        })
        .build()
        .start();
    } catch (err) {
      settleReject(
        frameError(
          ErrorCodes.PAYMENT_FAILED,
          err instanceof Error ? err.message : 'Failed to launch identity verification.',
        ),
      );
    }
  });
}

// Test-only — clears the SDK cache so tests can swap implementations between
// `react-native-persona is missing` and `present` scenarios.
export function __resetPersonaSdkCache(): void {
  cachedSdk = undefined;
}
