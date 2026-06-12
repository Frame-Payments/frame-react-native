/**
 * Well-known error codes returned on the `code` field of a {@link FrameErrorShape}.
 * Use these constants for exhaustive `switch` / `if` matching instead of raw
 * string literals so your code stays in sync when new codes are added.
 *
 * @example
 * ```ts
 * import { ErrorCodes } from 'framepayments-react-native';
 *
 * try {
 *   await Frame.presentCheckout({ accountId, amount });
 * } catch (err: unknown) {
 *   if (isFrameError(err) && err.code === ErrorCodes.USER_CANCELED) return;
 *   throw err;
 * }
 * ```
 */
export const ErrorCodes = {
  /** {@link initialize} was not called before invoking a present* function. */
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  /** The user dismissed the sheet without completing the flow. */
  USER_CANCELED: 'USER_CANCELED',
  /** iOS only — no root view controller available to present the sheet. */
  NO_ROOT_VC: 'NO_ROOT_VC',
  /** Android only — no current activity available to present the sheet. */
  NO_ACTIVITY: 'NO_ACTIVITY',
  /** Cart items array is empty or malformed. */
  INVALID_ITEMS: 'INVALID_ITEMS',
  /** The supplied `accountId` is missing or invalid. */
  INVALID_ACCOUNT: 'INVALID_ACCOUNT',
  /** The supplied {@link WalletOwner} is missing or has an unrecognized type. */
  INVALID_OWNER: 'INVALID_OWNER',
  /** Apple Pay or Google Pay merchant ID is missing or misconfigured. */
  INVALID_MERCHANT_ID: 'INVALID_MERCHANT_ID',
  /** The payment amount is zero, negative, or non-finite. */
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  /** A network request failed due to connectivity. */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** The Frame API returned an unexpected error response. */
  API_ERROR: 'API_ERROR',
  /** The API response could not be parsed. */
  PARSE_ERROR: 'PARSE_ERROR',
  /** The native bridge returned no result after the sheet closed. */
  NO_RESULT: 'NO_RESULT',
  /** The SDK failed to initialize on the native side. */
  INIT_FAILED: 'INIT_FAILED',
  /** Apple Pay is not available on this device or region. */
  APPLE_PAY_UNAVAILABLE: 'APPLE_PAY_UNAVAILABLE',
  /** Google Pay is not available on this device. */
  GOOGLE_PAY_UNAVAILABLE: 'GOOGLE_PAY_UNAVAILABLE',
  /** Plaid is not available or not linked. */
  PLAID_UNAVAILABLE: 'PLAID_UNAVAILABLE',
  /** Camera permission was denied or hardware is unavailable. */
  CAMERA_UNAVAILABLE: 'CAMERA_UNAVAILABLE',
  /** The operation is not supported on the current platform. */
  PLATFORM_UNSUPPORTED: 'PLATFORM_UNSUPPORTED',
  /** Device attestation has not been completed. Call {@link ensureAttested} first. */
  NOT_ATTESTED: 'NOT_ATTESTED',
  /** The App Attest flow failed (e.g. key generation or server verification error). */
  ATTESTATION_FAILED: 'ATTESTATION_FAILED',
  /** Adding or updating a payment method failed. */
  PAYMENT_METHOD_FAILED: 'PAYMENT_METHOD_FAILED',
  /** Charging or authorizing the payment failed. */
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  /** API response body failed JSON decoding. */
  API_DECODE: 'API_DECODE',
  /** API returned a 422 validation error. */
  API_VALIDATION: 'API_VALIDATION',
  /** API request failed due to a network-layer error. */
  API_NETWORK: 'API_NETWORK',
  /** A publishable key was expected but not found in the SDK config. */
  MISSING_PUBLISHABLE_KEY: 'MISSING_PUBLISHABLE_KEY',
  /** A secret key was expected but not found in the SDK config. */
  MISSING_SECRET_KEY: 'MISSING_SECRET_KEY',
} as const;

/**
 * Union of all string values defined in {@link ErrorCodes}. Use this as the
 * `code` type when narrowing a caught error.
 */
export type FrameErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * The shape of a structured error emitted by the Frame SDK. Thrown errors are
 * plain `Error` instances with an added `code` property; this interface
 * represents the plain-object form returned from async native-bridge callbacks.
 *
 * Use `isFrameError` (internal helper) to narrow an unknown value to this type.
 */
export interface FrameErrorShape {
  /** Machine-readable error code. One of the values in {@link ErrorCodes}. */
  code: string;
  /** Human-readable description of the error. */
  message: string;
  /** Original native error string, if the failure originated in native code. */
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
