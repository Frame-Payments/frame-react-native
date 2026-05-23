export const ErrorCodes = {
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  USER_CANCELED: 'USER_CANCELED',
  NO_ROOT_VC: 'NO_ROOT_VC',
  NO_ACTIVITY: 'NO_ACTIVITY',
  INVALID_ITEMS: 'INVALID_ITEMS',
  INVALID_ACCOUNT: 'INVALID_ACCOUNT',
  INVALID_OWNER: 'INVALID_OWNER',
  INVALID_MERCHANT_ID: 'INVALID_MERCHANT_ID',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  NO_RESULT: 'NO_RESULT',
  INIT_FAILED: 'INIT_FAILED',
  APPLE_PAY_UNAVAILABLE: 'APPLE_PAY_UNAVAILABLE',
  GOOGLE_PAY_UNAVAILABLE: 'GOOGLE_PAY_UNAVAILABLE',
  PLAID_UNAVAILABLE: 'PLAID_UNAVAILABLE',
  CAMERA_UNAVAILABLE: 'CAMERA_UNAVAILABLE',
  PLATFORM_UNSUPPORTED: 'PLATFORM_UNSUPPORTED',
  NOT_ATTESTED: 'NOT_ATTESTED',
  ATTESTATION_FAILED: 'ATTESTATION_FAILED',
  PAYMENT_METHOD_FAILED: 'PAYMENT_METHOD_FAILED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  API_DECODE: 'API_DECODE',
  API_VALIDATION: 'API_VALIDATION',
  API_NETWORK: 'API_NETWORK',
  MISSING_PUBLISHABLE_KEY: 'MISSING_PUBLISHABLE_KEY',
  MISSING_SECRET_KEY: 'MISSING_SECRET_KEY',
} as const;

export type FrameErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface FrameErrorShape {
  code: string;
  message: string;
  nativeError?: string;
}

export function frameError(code: string, message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

export function isFrameError(error: unknown): error is FrameErrorShape {
  // Plain Error instances (and subclasses like FrameAPIError) duck-type as
  // FrameErrorShape via inherited .message and an added .code, but they're
  // not the consumer-facing shape — exclude them so callers route through
  // the proper adapter (api-errors.toFrameError).
  if (error instanceof Error) return false;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as FrameErrorShape).code === 'string' &&
    typeof (error as FrameErrorShape).message === 'string'
  );
}

export function normalizeToFrameError(reject: unknown): FrameErrorShape {
  if (isFrameError(reject)) {
    return reject;
  }
  if (reject instanceof Error) {
    const code = (reject as Error & { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { code, message: reject.message, nativeError: reject.stack };
  }
  if (typeof reject === 'object' && reject !== null && 'code' in reject && 'message' in reject) {
    return reject as FrameErrorShape;
  }
  return {
    code: 'UNKNOWN_ERROR',
    message: String(reject),
  };
}
