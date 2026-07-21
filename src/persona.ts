import { ErrorCodes, frameError } from './errors';

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
